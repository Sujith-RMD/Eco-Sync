import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  culpritVotes,
  hintUsages,
  puzzleAttempts,
  puzzles,
  roundParticipations,
  rounds,
  scoreEvents,
  teamPuzzleProgress,
  teams,
  type Round,
} from "@/db/schema";
import { GAME_CONSTANTS } from "@/server/game/constants";
import {
  normalizeAnswer,
  rankRound2,
  rankStandings,
  timeBonusPoints,
  wrongPenaltyForAttempt,
  type StandingInput,
} from "@/server/game/rules";
import {
  CORRECT_SUSPECT_CODE,
  FINAL_CODE_PUZZLE_CODE,
  PUZZLE_REVEALS,
  SUSPECTS,
  isKnownSuspect,
} from "@/server/game/catalogue";
import { auditRoundAnswers } from "@/server/game/content-guard";
import { describeUnarmed } from "@/server/game/unarmed";
import { logAudit } from "@/server/audit/log";
import type {
  LeaderboardRow,
  PuzzleSnapshot,
  RoundCode,
  RoundInfo,
  RoundSnapshot,
  TeamSnapshotResult,
} from "@/types/game";

const C = GAME_CONSTANTS;

/* -------------------------------------------------------------------------- */
/* Round state helpers                                                         */
/* -------------------------------------------------------------------------- */

function buildRoundInfo(round: Round, now: Date): RoundInfo {
  const remainingSeconds =
    round.startedAt && round.endsAt
      ? Math.max(0, Math.floor((round.endsAt.getTime() - now.getTime()) / 1000))
      : null;
  return {
    code: round.code,
    status: round.status,
    startedAt: round.startedAt?.toISOString() ?? null,
    endsAt: round.endsAt?.toISOString() ?? null,
    durationMinutes: round.durationMinutes,
    serverTime: now.toISOString(),
    remainingSeconds,
  };
}

function isAcceptingSubmissions(round: Round, now: Date): boolean {
  if (round.status !== "ACTIVE") return false;
  if (round.endsAt && now.getTime() >= round.endsAt.getTime()) return false;
  return true;
}

async function findParticipation(teamId: number, roundId: number) {
  return db.query.roundParticipations.findFirst({
    where: and(
      eq(roundParticipations.teamId, teamId),
      eq(roundParticipations.roundId, roundId),
    ),
  });
}

/* -------------------------------------------------------------------------- */
/* Team snapshot (client-safe DTO assembly)                                    */
/* -------------------------------------------------------------------------- */

export async function getTeamRoundSnapshot(
  teamId: number,
  teamName: string,
  roundCode: RoundCode,
): Promise<TeamSnapshotResult> {
  const now = new Date();
  const round = await db.query.rounds.findFirst({
    where: eq(rounds.code, roundCode),
  });
  if (!round) return { kind: "uninitialized" };

  const roundInfo = buildRoundInfo(round, now);

  // Round 2 is qualification-gated.
  if (roundCode === "ROUND_2") {
    const participation = await findParticipation(teamId, round.id);
    if (!participation) {
      let reason: "AWAITING_QUALIFICATION" | "NOT_QUALIFIED" =
        "AWAITING_QUALIFICATION";
      const r1 = await db.query.rounds.findFirst({
        where: eq(rounds.code, "ROUND_1"),
      });
      if (r1) {
        const r1Participation = await findParticipation(teamId, r1.id);
        if (r1Participation && r1Participation.qualified === false) {
          reason = "NOT_QUALIFIED";
        }
      }
      return { kind: "gated", round: roundInfo, reason };
    }
  }

  if (round.status === "PENDING") {
    return { kind: "pending", round: roundInfo };
  }

  // Bootstrap (idempotent): participation row + first puzzle unlocked.
  if (round.status === "ACTIVE") {
    await db
      .insert(roundParticipations)
      .values({ teamId, roundId: round.id })
      .onConflictDoNothing();
    const firstPuzzle = await db.query.puzzles.findFirst({
      where: and(eq(puzzles.roundId, round.id), eq(puzzles.orderIndex, 1)),
    });
    if (firstPuzzle) {
      await db
        .insert(teamPuzzleProgress)
        .values({
          teamId,
          puzzleId: firstPuzzle.id,
          status: "UNLOCKED",
          unlockedAt: now,
        })
        .onConflictDoNothing();
    }
  }

  const roundPuzzles = await db
    .select()
    .from(puzzles)
    .where(eq(puzzles.roundId, round.id))
    .orderBy(asc(puzzles.orderIndex));

  const puzzleIds = roundPuzzles.map((p) => p.id);

  const progressRows =
    puzzleIds.length === 0
      ? []
      : await db
          .select()
          .from(teamPuzzleProgress)
          .where(
            and(
              eq(teamPuzzleProgress.teamId, teamId),
              inArray(teamPuzzleProgress.puzzleId, puzzleIds),
            ),
          );

  const hintRows =
    puzzleIds.length === 0
      ? []
      : await db
          .select()
          .from(hintUsages)
          .where(
            and(
              eq(hintUsages.teamId, teamId),
              inArray(hintUsages.puzzleId, puzzleIds),
            ),
          );

  const [{ total }] = await db
    .select({
      total: sql<number>`coalesce(sum(${scoreEvents.delta}), 0)::int`.mapWith(
        Number,
      ),
    })
    .from(scoreEvents)
    .where(
      and(eq(scoreEvents.teamId, teamId), eq(scoreEvents.roundId, round.id)),
    );

  const participation = await findParticipation(teamId, round.id);

  // Round 2: vote state + final puzzle solved?
  let vote: RoundSnapshot["vote"];
  if (roundCode === "ROUND_2") {
    const finalPuzzle = roundPuzzles.find(
      (p) => p.code === FINAL_CODE_PUZZLE_CODE,
    );
    const finalProgress = finalPuzzle
      ? progressRows.find((row) => row.puzzleId === finalPuzzle.id)
      : undefined;
    const existingVote = await db.query.culpritVotes.findFirst({
      where: eq(culpritVotes.teamId, teamId),
    });
    vote = {
      unlocked: finalProgress?.status === "SOLVED",
      submitted: Boolean(existingVote),
      suspectCode: existingVote?.suspectCode ?? null,
      suspects: SUSPECTS.map((s) => ({ code: s.code, name: s.name, role: s.role })),
    };
  }

  let currentAssigned = false;
  const puzzleSnapshots: PuzzleSnapshot[] = roundPuzzles.map((p) => {
    const prog = progressRows.find((row) => row.puzzleId === p.id);
    const status = prog?.status ?? "LOCKED";
    const hintList = Array.isArray(p.hints) ? p.hints : [];
    const usedHints = hintRows
      .filter((h) => h.puzzleId === p.id)
      .sort((a, b) => a.hintIndex - b.hintIndex)
      .map((h) => hintList[h.hintIndex])
      .filter((text): text is string => typeof text === "string");

    let isCurrent = false;
    if (status === "UNLOCKED" && !currentAssigned) {
      isCurrent = true;
      currentAssigned = true;
    }

    return {
      code: p.code,
      orderIndex: p.orderIndex,
      kind: p.kind,
      title: p.title,
      briefing: status === "LOCKED" ? null : p.briefing,
      points: p.points,
      status,
      isCurrent,
      wrongAttempts: prog?.wrongAttempts ?? 0,
      penaltyPoints: prog?.wrongPenaltyPoints ?? 0,
      lockedUntil: prog?.lockedUntil ? prog.lockedUntil.toISOString() : null,
      solvedAt: prog?.solvedAt ? prog.solvedAt.toISOString() : null,
      hintsAvailable:
        status === "LOCKED" ? 0 : Math.max(0, hintList.length - usedHints.length),
      usedHints,
      // Gated on SOLVED, never on UNLOCKED: the reveal URL contains the answer,
      // so it must not reach the client before the link is actually broken.
      reveal: status === "SOLVED" ? (PUZZLE_REVEALS[p.code] ?? null) : null,
    };
  });

  const solvedCount = puzzleSnapshots.filter((p) => p.status === "SOLVED").length;
  const current = puzzleSnapshots.find((p) => p.isCurrent) ?? null;

  const snapshot: RoundSnapshot = {
    teamName,
    round: roundInfo,
    score: total,
    solvedCount,
    totalCount: roundPuzzles.length,
    puzzles: puzzleSnapshots,
    currentPuzzleCode: current?.code ?? null,
    finished: participation?.finishedAt != null,
    finishedAt: participation?.finishedAt
      ? participation.finishedAt.toISOString()
      : null,
    finalRank: participation?.finalRank ?? null,
    qualified: participation?.qualified ?? null,
    vote,
  };

  return { kind: "ready", snapshot };
}

/* -------------------------------------------------------------------------- */
/* Submissions — the server-authoritative puzzle pipeline (spec §8–§13)         */
/* -------------------------------------------------------------------------- */

export type SubmitOutcome =
  | "CORRECT"
  | "WRONG"
  | "LOCKOUT"
  | "LOCKED_PUZZLE"
  | "ALREADY_SOLVED"
  | "ROUND_NOT_ACTIVE"
  | "ROUND_EXPIRED"
  | "PUZZLE_UNKNOWN"
  | "NOT_QUALIFIED"
  | "ERROR";

export interface SubmitResult {
  outcome: SubmitOutcome;
  message: string;
  lockoutUntil?: Date | null;
  deduction?: number;
}

interface LockedProgressRow {
  id: number;
  status: "LOCKED" | "UNLOCKED" | "SOLVED";
  wrong_attempts: number;
  wrong_penalty_points: number;
  hints_used: number;
  locked_until: Date | null;
}

export async function submitAnswer(input: {
  teamId: number;
  roundCode: RoundCode;
  puzzleCode: string;
  rawAnswer: string;
}): Promise<SubmitResult> {
  const { teamId, roundCode, rawAnswer } = input;
  const now = new Date();

  const round = await db.query.rounds.findFirst({
    where: eq(rounds.code, roundCode),
  });
  if (!round) {
    return { outcome: "ERROR", message: "Event is not initialized. Contact coordinators." };
  }
  if (round.status !== "ACTIVE") {
    return {
      outcome: "ROUND_NOT_ACTIVE",
      message: "This round is not live. Await the go-signal from command.",
    };
  }
  if (round.endsAt && now.getTime() >= round.endsAt.getTime()) {
    return {
      outcome: "ROUND_EXPIRED",
      message: "Official time has expired. Submissions are closed.",
    };
  }

  if (roundCode === "ROUND_2") {
    const participation = await findParticipation(teamId, round.id);
    if (!participation) {
      return { outcome: "NOT_QUALIFIED", message: "Your unit did not qualify for Round 02." };
    }
  }

  const puzzle = await db.query.puzzles.findFirst({
    where: and(eq(puzzles.roundId, round.id), eq(puzzles.code, input.puzzleCode)),
  });
  if (!puzzle) return { outcome: "PUZZLE_UNKNOWN", message: "Unknown puzzle reference." };

  const roundPuzzles = await db
    .select({ id: puzzles.id, code: puzzles.code, orderIndex: puzzles.orderIndex })
    .from(puzzles)
    .where(eq(puzzles.roundId, round.id))
    .orderBy(asc(puzzles.orderIndex));

  const result = await db.transaction(async (tx): Promise<SubmitResult> => {
    // Idempotent bootstrap of puzzle #1 (covers "submit before any visit").
    if (puzzle.orderIndex === 1) {
      await tx
        .insert(teamPuzzleProgress)
        .values({ teamId, puzzleId: puzzle.id, status: "UNLOCKED", unlockedAt: now })
        .onConflictDoNothing();
    }

    const locked = await tx.execute(
      sql`select id, status, wrong_attempts, wrong_penalty_points, hints_used, locked_until
          from team_puzzle_progress
          where team_id = ${teamId} and puzzle_id = ${puzzle.id}
          for update`,
    );
    const progress = (locked.rows[0] ?? null) as unknown as LockedProgressRow | null;

    if (!progress || progress.status === "LOCKED") {
      return { outcome: "LOCKED_PUZZLE", message: "This puzzle is sealed. Solve the active puzzle first." };
    }
    if (progress.status === "SOLVED") {
      return { outcome: "ALREADY_SOLVED", message: "Puzzle already solved. Move to the active puzzle." };
    }
    if (progress.locked_until && new Date(progress.locked_until).getTime() > now.getTime()) {
      const until = new Date(progress.locked_until);
      const retryAfter = Math.ceil((until.getTime() - now.getTime()) / 1000);
      return {
        outcome: "LOCKOUT",
        message: `Submission lockout active — ${retryAfter}s remaining.`,
        lockoutUntil: until,
      };
    }

    const normalized = normalizeAnswer(rawAnswer);
    const isCorrect = normalized === puzzle.expectedAnswerNormalized;

    if (!isCorrect) {
      const deduction = wrongPenaltyForAttempt(
        progress.wrong_penalty_points,
        C.scoring.wrongAnswerPenalty,
        C.scoring.wrongAnswerPenaltyCapPerPuzzle,
      );
      await tx.insert(puzzleAttempts).values({
        teamId,
        puzzleId: puzzle.id,
        submittedAnswer: rawAnswer.slice(0, 500),
        normalizedAnswer: normalized.slice(0, 255),
        isCorrect: false,
        penaltyApplied: deduction,
      });
      if (deduction > 0) {
        await tx.insert(scoreEvents).values({
          teamId,
          roundId: round.id,
          puzzleId: puzzle.id,
          type: "WRONG_ANSWER",
          delta: -deduction,
          meta: { attempt: progress.wrong_attempts + 1 },
        });
      }
      const lockoutUntil = new Date(now.getTime() + C.scoring.lockoutSeconds * 1000);
      await tx
        .update(teamPuzzleProgress)
        .set({
          wrongAttempts: progress.wrong_attempts + 1,
          wrongPenaltyPoints: progress.wrong_penalty_points + deduction,
          lockedUntil: lockoutUntil,
        })
        .where(eq(teamPuzzleProgress.id, progress.id));

      return {
        outcome: "WRONG",
        message:
          deduction > 0
            ? `Incorrect. −${deduction} points. ${C.scoring.lockoutSeconds}s lockout engaged.`
            : `Incorrect. Penalty cap reached for this puzzle. ${C.scoring.lockoutSeconds}s lockout engaged.`,
        lockoutUntil,
        deduction,
      };
    }

    // Correct answer.
    await tx.insert(puzzleAttempts).values({
      teamId,
      puzzleId: puzzle.id,
      submittedAnswer: rawAnswer.slice(0, 500),
      normalizedAnswer: normalized.slice(0, 255),
      isCorrect: true,
      penaltyApplied: 0,
    });
    await tx
      .update(teamPuzzleProgress)
      .set({ status: "SOLVED", solvedAt: now, lockedUntil: null })
      .where(eq(teamPuzzleProgress.id, progress.id));
    if (puzzle.points > 0) {
      await tx.insert(scoreEvents).values({
        teamId,
        roundId: round.id,
        puzzleId: puzzle.id,
        type: "PUZZLE_SOLVED",
        delta: puzzle.points,
        meta: { code: puzzle.code },
      });
    }

    const next = roundPuzzles.find((p) => p.orderIndex === puzzle.orderIndex + 1);
    if (next) {
      await tx
        .insert(teamPuzzleProgress)
        .values({ teamId, puzzleId: next.id, status: "UNLOCKED", unlockedAt: now })
        .onConflictDoNothing();
      return { outcome: "CORRECT", message: "Entry accepted. The next puzzle is unlocked." };
    }

    // Last puzzle of the round: finish the run (+ Round 1 time bonus).
    const remainingSecondsAtFinish = round.endsAt
      ? Math.max(0, Math.floor((round.endsAt.getTime() - now.getTime()) / 1000))
      : 0;
    await tx
      .insert(roundParticipations)
      .values({ teamId, roundId: round.id, finishedAt: now, remainingSecondsAtFinish })
      .onConflictDoUpdate({
        target: [roundParticipations.teamId, roundParticipations.roundId],
        set: { finishedAt: now, remainingSecondsAtFinish },
      });

    if (roundCode === "ROUND_1") {
      const bonusPoints = timeBonusPoints(
        remainingSecondsAtFinish,
        C.scoring.timeBonusPerFullMinute,
      );
      if (bonusPoints > 0) {
        await tx.insert(scoreEvents).values({
          teamId,
          roundId: round.id,
          puzzleId: puzzle.id,
          type: "TIME_BONUS",
          delta: bonusPoints,
          meta: { remainingSeconds: remainingSecondsAtFinish },
        });
      }
      return {
        outcome: "CORRECT",
        message:
          bonusPoints > 0
            ? `Round 01 complete. Time bonus +${bonusPoints} secured.`
            : "Round 01 complete. Stand by for qualification.",
      };
    }
    return {
      outcome: "CORRECT",
      message: "Final code accepted. The culprit vote is now unsealed.",
    };
  });

  await logAudit({
    actorType: "TEAM",
    actorId: teamId,
    action:
      result.outcome === "CORRECT" ? "game.puzzle.solved" : "game.puzzle.attempt",
    entity: "puzzle",
    entityId: input.puzzleCode,
    meta: { round: roundCode, outcome: result.outcome },
  });

  return result;
}

/* -------------------------------------------------------------------------- */
/* Hints (spec §11)                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Claim the next unspent hint. Named with a verb, not a `use` prefix: this is a
 * server-side transaction, and the React lint rules reserve `use*` for hooks.
 */
export async function claimHint(input: {
  teamId: number;
  roundCode: RoundCode;
  puzzleCode: string;
}): Promise<{ ok: boolean; hint?: string; error?: string }> {
  const { teamId, roundCode } = input;
  const now = new Date();

  const round = await db.query.rounds.findFirst({
    where: eq(rounds.code, roundCode),
  });
  if (!round || !isAcceptingSubmissions(round, now)) {
    return { ok: false, error: "Hints are only available while the round is live." };
  }

  if (roundCode === "ROUND_2") {
    const participation = await findParticipation(teamId, round.id);
    if (!participation) return { ok: false, error: "Round 02 access not granted." };
  }

  const puzzle = await db.query.puzzles.findFirst({
    where: and(eq(puzzles.roundId, round.id), eq(puzzles.code, input.puzzleCode)),
  });
  if (!puzzle) return { ok: false, error: "Unknown puzzle reference." };

  // Symmetric with submitAnswer: entering the round bootstraps puzzle #1.
  if (puzzle.orderIndex === 1) {
    await db
      .insert(teamPuzzleProgress)
      .values({ teamId, puzzleId: puzzle.id, status: "UNLOCKED", unlockedAt: now })
      .onConflictDoNothing();
  }

  const hintList = Array.isArray(puzzle.hints) ? puzzle.hints : [];

  const result = await db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`select id, status, hints_used from team_puzzle_progress
          where team_id = ${teamId} and puzzle_id = ${puzzle.id} for update`,
    );
    const progress = (locked.rows[0] ?? null) as {
      id: number;
      status: string;
      hints_used: number;
    } | null;

    if (!progress || progress.status !== "UNLOCKED") {
      return { ok: false as const, error: "Hints unlock with the active puzzle." };
    }
    const hintIndex = progress.hints_used;
    if (hintIndex >= hintList.length) {
      return { ok: false as const, error: "No hints remain for this puzzle." };
    }

    const inserted = await tx
      .insert(hintUsages)
      .values({ teamId, puzzleId: puzzle.id, hintIndex, penaltyApplied: C.scoring.hintPenalty })
      .onConflictDoNothing()
      .returning({ id: hintUsages.id });

    if (inserted.length === 0) {
      return { ok: false as const, error: "Hint already claimed." };
    }

    await tx.insert(scoreEvents).values({
      teamId,
      roundId: round.id,
      puzzleId: puzzle.id,
      type: "HINT_USED",
      delta: -C.scoring.hintPenalty,
      meta: { hintIndex },
    });
    await tx
      .update(teamPuzzleProgress)
      .set({ hintsUsed: progress.hints_used + 1 })
      .where(eq(teamPuzzleProgress.id, progress.id));

    return { ok: true as const, hint: hintList[hintIndex] };
  });

  if (result.ok) {
    await logAudit({
      actorType: "TEAM",
      actorId: teamId,
      action: "game.hint.used",
      entity: "puzzle",
      entityId: input.puzzleCode,
      meta: { round: roundCode },
    });
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Culprit vote (spec §18)                                                      */
/* -------------------------------------------------------------------------- */

export type CastVoteOutcome =
  | "SEALED"
  | "DUPLICATE"
  | "NOT_UNLOCKED"
  | "INVALID_SUSPECT"
  | "ROUND_NOT_ACTIVE"
  | "NOT_QUALIFIED"
  | "ERROR";

export async function castVote(input: {
  teamId: number;
  suspectCode: string;
}): Promise<{ outcome: CastVoteOutcome; message: string }> {
  const { teamId, suspectCode } = input;
  const now = new Date();

  const round = await db.query.rounds.findFirst({
    where: eq(rounds.code, "ROUND_2"),
  });
  if (!round) return { outcome: "ERROR", message: "Event is not initialized." };

  /*
    Voting deliberately outlives the round. `endRound` is the operator's natural
    move the instant the clock reaches 75:00, and it used to close the ballot —
    so a unit that broke the final code at minute 74 lost the game's finale to an
    act of housekeeping, permanently, with no override anywhere in the deck.

    The ballot therefore stays open through ENDED, and closes only when the event
    is restarted or purged — both of which return ROUND_2 to PENDING. This is the
    `submitAnswer`/`castVote` asymmetry made deliberate rather than incidental:
    END closes the chain because the round is over, but a verdict is a separate,
    final act that the round's end must not confiscate. It stays gated on having
    solved the final code below, so the ballot still has to be earned.
  */
  if (round.status !== "ACTIVE" && round.status !== "ENDED") {
    return {
      outcome: "ROUND_NOT_ACTIVE",
      message: "Voting opens with Round 02 and stays open after it ends.",
    };
  }

  const participation = await findParticipation(teamId, round.id);
  if (!participation) {
    return { outcome: "NOT_QUALIFIED", message: "Your unit did not qualify for Round 02." };
  }

  const finalPuzzle = await db.query.puzzles.findFirst({
    where: and(eq(puzzles.roundId, round.id), eq(puzzles.code, FINAL_CODE_PUZZLE_CODE)),
  });
  if (!finalPuzzle) return { outcome: "ERROR", message: "Final code puzzle missing." };

  const finalProgress = await db.query.teamPuzzleProgress.findFirst({
    where: and(
      eq(teamPuzzleProgress.teamId, teamId),
      eq(teamPuzzleProgress.puzzleId, finalPuzzle.id),
    ),
  });
  if (finalProgress?.status !== "SOLVED") {
    return { outcome: "NOT_UNLOCKED", message: "Break the final code to unseal the vote." };
  }

  if (!isKnownSuspect(suspectCode)) {
    return { outcome: "INVALID_SUSPECT", message: "Unknown suspect selection." };
  }

  const inserted = await db
    .insert(culpritVotes)
    .values({ teamId, suspectCode })
    .onConflictDoNothing()
    .returning({ id: culpritVotes.id });

  if (inserted.length === 0) {
    return { outcome: "DUPLICATE", message: "Your unit's vote is already sealed." };
  }

  await logAudit({
    actorType: "TEAM",
    actorId: teamId,
    action: "game.vote.sealed",
    entity: "culprit_vote",
    entityId: teamId,
    meta: { suspectCode },
  });

  return {
    outcome: "SEALED",
    message: "Vote sealed in the custody chain. The verdict is out of your hands.",
  };
}

/* -------------------------------------------------------------------------- */
/* Standings / leaderboards                                                     */
/* -------------------------------------------------------------------------- */

async function loadRound1StandingInputs(): Promise<StandingInput[]> {
  const r1 = await db.query.rounds.findFirst({
    where: eq(rounds.code, "ROUND_1"),
  });
  if (!r1) return [];

  const allTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .orderBy(asc(teams.name));

  const scores = await db
    .select({
      teamId: scoreEvents.teamId,
      total: sql<number>`coalesce(sum(${scoreEvents.delta}), 0)::int`.mapWith(Number),
    })
    .from(scoreEvents)
    .where(eq(scoreEvents.roundId, r1.id))
    .groupBy(scoreEvents.teamId);

  const progressAgg = await db
    .select({
      teamId: teamPuzzleProgress.teamId,
      solved: sql<number>`count(*) filter (where ${teamPuzzleProgress.status} = 'SOLVED')::int`.mapWith(Number),
      wrong: sql<number>`coalesce(sum(${teamPuzzleProgress.wrongPenaltyPoints}), 0)::int`.mapWith(Number),
      hints: sql<number>`coalesce(sum(${teamPuzzleProgress.hintsUsed}), 0)::int`.mapWith(Number),
    })
    .from(teamPuzzleProgress)
    .innerJoin(puzzles, eq(puzzles.id, teamPuzzleProgress.puzzleId))
    .where(eq(puzzles.roundId, r1.id))
    .groupBy(teamPuzzleProgress.teamId);

  const participationRows = await db
    .select()
    .from(roundParticipations)
    .where(eq(roundParticipations.roundId, r1.id));

  return allTeams.map((team) => ({
    teamId: team.id,
    teamName: team.name,
    score: scores.find((s) => s.teamId === team.id)?.total ?? 0,
    finishedAt:
      participationRows.find((p) => p.teamId === team.id)?.finishedAt ?? null,
    solvedCount: progressAgg.find((p) => p.teamId === team.id)?.solved ?? 0,
    totalWrongPenalty: progressAgg.find((p) => p.teamId === team.id)?.wrong ?? 0,
    totalHints: progressAgg.find((p) => p.teamId === team.id)?.hints ?? 0,
  }));
}

export async function computeRound1Standings() {
  return rankStandings(await loadRound1StandingInputs());
}

export async function publicLeaderboard(roundCode: RoundCode): Promise<{
  status: Round["status"] | null;
  rows: LeaderboardRow[];
}> {
  const round = await db.query.rounds.findFirst({
    where: eq(rounds.code, roundCode),
  });
  if (!round) return { status: null, rows: [] };

  if (roundCode === "ROUND_1") {
    const standings = await computeRound1Standings();
    const participationRows = await db
      .select()
      .from(roundParticipations)
      .where(eq(roundParticipations.roundId, round.id));
    return {
      status: round.status,
      rows: standings.map((s) => ({
        rank: s.rank,
        teamId: s.teamId,
        name: s.teamName,
        score: s.score,
        solvedCount: s.solvedCount,
        finishedAt: s.finishedAt ? s.finishedAt.toISOString() : null,
        qualified:
          participationRows.find((p) => p.teamId === s.teamId)?.qualified ?? null,
        voted: false,
      })),
    };
  }

  // Round 2: participants only, ranked by finish then depth.
  const participants = await db
    .select({
      teamId: roundParticipations.teamId,
      finishedAt: roundParticipations.finishedAt,
      name: teams.name,
    })
    .from(roundParticipations)
    .innerJoin(teams, eq(teams.id, roundParticipations.teamId))
    .where(eq(roundParticipations.roundId, round.id));

  const scores = await db
    .select({
      teamId: scoreEvents.teamId,
      total: sql<number>`coalesce(sum(${scoreEvents.delta}), 0)::int`.mapWith(Number),
    })
    .from(scoreEvents)
    .where(eq(scoreEvents.roundId, round.id))
    .groupBy(scoreEvents.teamId);

  const progressAgg = await db
    .select({
      teamId: teamPuzzleProgress.teamId,
      solved: sql<number>`count(*) filter (where ${teamPuzzleProgress.status} = 'SOLVED')::int`.mapWith(Number),
    })
    .from(teamPuzzleProgress)
    .innerJoin(puzzles, eq(puzzles.id, teamPuzzleProgress.puzzleId))
    .where(eq(puzzles.roundId, round.id))
    .groupBy(teamPuzzleProgress.teamId);

  const votes = await db.select({ teamId: culpritVotes.teamId }).from(culpritVotes);

  const ranked = rankRound2(
    participants.map((p) => ({
      teamId: p.teamId,
      name: p.name,
      finishedAt: p.finishedAt,
      score: scores.find((s) => s.teamId === p.teamId)?.total ?? 0,
      solvedCount: progressAgg.find((s) => s.teamId === p.teamId)?.solved ?? 0,
      voted: votes.some((v) => v.teamId === p.teamId),
    })),
  );

  return {
    status: round.status,
    rows: ranked.map((row, index) => ({
      rank: index + 1,
      teamId: row.teamId,
      name: row.name,
      score: row.score,
      solvedCount: row.solvedCount,
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
      qualified: null,
      voted: row.voted,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Admin round operations (always audited)                                     */
/* -------------------------------------------------------------------------- */

export async function startRound(
  adminId: number,
  code: RoundCode,
): Promise<{ ok: boolean; message: string }> {
  const round = await db.query.rounds.findFirst({ where: eq(rounds.code, code) });
  if (!round) return { ok: false, message: "Round is not initialized. Seed the event first." };
  if (round.status !== "PENDING") {
    return { ok: false, message: `Illegal transition: round is ${round.status}.` };
  }
  if (code === "ROUND_2") {
    const participants = await db
      .select({ teamId: roundParticipations.teamId })
      .from(roundParticipations)
      .where(eq(roundParticipations.roundId, round.id));
    if (participants.length === 0) {
      return { ok: false, message: "No qualified units. Run QUALIFY TOP 15 first." };
    }
  }

  /*
    Fail closed on content that cannot be completed. An un-armed answer strands
    every link behind it (the chain unseals `orderIndex + 1` by exact match), and
    an empty chain strands the whole round, so neither may be opened — the
    operator is told which links to fix rather than discovering it from 60 rooms.
  */
  const answerAudit = await auditRoundAnswers(round.id);
  const roundLabel = code === "ROUND_1" ? "Round 01" : "Round 02";
  let blockReason: string | null = null;
  if (answerAudit.total === 0) {
    blockReason = `${roundLabel} has no puzzles. Seed the event before opening it.`;
  } else if (answerAudit.unarmed.length > 0) {
    blockReason = describeUnarmed(answerAudit.unarmed, answerAudit.total, roundLabel);
  }
  if (blockReason !== null) {
    await logAudit({
      actorType: "ADMIN",
      actorId: adminId,
      action: "round.start.blocked",
      entity: "round",
      entityId: code,
      meta: {
        reason: answerAudit.total === 0 ? "NO_PUZZLES" : "UNARMED_ANSWERS",
        unarmed: answerAudit.unarmed.map((entry) => entry.code),
        detail: blockReason,
      },
    });
    return { ok: false, message: blockReason };
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + round.durationMinutes * 60_000);
  await db
    .update(rounds)
    .set({ status: "ACTIVE", startedAt: now, endsAt })
    .where(and(eq(rounds.id, round.id), eq(rounds.status, "PENDING")));

  await logAudit({
    actorType: "ADMIN",
    actorId: adminId,
    action: "round.start",
    entity: "round",
    entityId: code,
    meta: { endsAt: endsAt.toISOString() },
  });
  return { ok: true, message: `${code === "ROUND_1" ? "Round 01" : "Round 02"} is live. Official clock started.` };
}

export async function endRound(
  adminId: number,
  code: RoundCode,
): Promise<{ ok: boolean; message: string }> {
  const round = await db.query.rounds.findFirst({ where: eq(rounds.code, code) });
  if (!round) return { ok: false, message: "Round is not initialized." };
  if (round.status !== "ACTIVE") {
    return { ok: false, message: `Illegal transition: round is ${round.status}.` };
  }
  await db
    .update(rounds)
    .set({ status: "ENDED", endedAt: new Date() })
    .where(and(eq(rounds.id, round.id), eq(rounds.status, "ACTIVE")));

  await logAudit({
    actorType: "ADMIN",
    actorId: adminId,
    action: "round.end",
    entity: "round",
    entityId: code,
  });
  return { ok: true, message: "Round ended. Submissions are closed." };
}

/**
 * Apply the supplied Round 1 qualification: rank by score → finish time →
 * penalties → hints, mark the top 15, and grant Round 2 access. Idempotent —
 * but only *within* its window, which is "after Round 01 has ended and before
 * Round 02 has begun". The guard below enforces that window rather than
 * assuming it.
 */
export async function applyQualification(
  adminId: number,
): Promise<{ ok: boolean; message: string }> {
  const [r1, r2] = await Promise.all([
    db.query.rounds.findFirst({ where: eq(rounds.code, "ROUND_1") }),
    db.query.rounds.findFirst({ where: eq(rounds.code, "ROUND_2") }),
  ]);
  if (!r1 || !r2) return { ok: false, message: "Rounds are not initialized." };

  /*
    Qualification rewrites the Round 2 roster, so it is only legal once Round 01
    is over and before Round 02 has begun. Both halves of that are load-bearing:

    - Pressed while Round 01 is live, it ranks a partial field and — because the
      round state machine is one-way — ends the round for all 60 units mid-play
      with no way back. It used to do that silently.
    - Pressed while Round 02 is live, it deletes and rebuilds the Round 2 roster
      from the *current* Round 1 standings, so any unit whose rank has moved is
      ejected from a round it is already playing.

    Neither is recoverable from the command deck, so the operator is refused
    instead of warned.
  */
  if (r1.status !== "ENDED") {
    return {
      ok: false,
      message: `Round 01 is ${r1.status}. End it before ranking the field — qualification closes the round.`,
    };
  }
  if (r2.status !== "PENDING") {
    return {
      ok: false,
      message: `Round 02 is already ${r2.status}. Qualification cannot be re-run once the round has begun.`,
    };
  }

  const standings = await computeRound1Standings();

  await db.transaction(async (tx) => {
    for (const standing of standings) {
      const qualified = standing.rank <= C.round1.qualifyingTeams;
      await tx
        .insert(roundParticipations)
        .values({
          teamId: standing.teamId,
          roundId: r1.id,
          finalScore: standing.score,
          finalRank: standing.rank,
          qualified,
        })
        .onConflictDoUpdate({
          target: [roundParticipations.teamId, roundParticipations.roundId],
          set: {
            finalScore: standing.score,
            finalRank: standing.rank,
            qualified,
          },
        });
    }

    // Rebuild Round 2 roster from the qualified set (idempotent).
    await tx.delete(roundParticipations).where(eq(roundParticipations.roundId, r2.id));
    const qualifiedStandings = standings.filter((s) => s.rank <= C.round1.qualifyingTeams);
    for (const standing of qualifiedStandings) {
      await tx
        .insert(roundParticipations)
        .values({ teamId: standing.teamId, roundId: r2.id })
        .onConflictDoNothing();
    }

    // Round 01 is guaranteed ENDED by the guard above, so it is already closed.
  });

  const qualified = Math.min(C.round1.qualifyingTeams, standings.length);
  await logAudit({
    actorType: "ADMIN",
    actorId: adminId,
    action: "round1.qualify",
    entity: "round",
    entityId: "ROUND_1",
    meta: { qualifiedCount: qualified, teamsRanked: standings.length },
  });
  return { ok: true, message: `Qualification applied. Top ${qualified} units marked; Round 02 roster rebuilt.` };
}

/* -------------------------------------------------------------------------- */
/* Admin repair — one unit, one link                                           */
/* -------------------------------------------------------------------------- */

export type RepairOutcome =
  | "UNLOCKED"
  | "ALREADY_OPEN"
  | "ALREADY_SOLVED"
  | "TEAM_UNKNOWN"
  | "PUZZLE_UNKNOWN"
  | "PUZZLE_AMBIGUOUS";

/**
 * The operator's one surgical lever: open a single link of a single unit's
 * chain, leaving every other unit untouched.
 *
 * Why this exists. The chain unseals `orderIndex + 1` by exact match, so when a
 * link is unpassable for one unit — a briefing read the wrong way, a physical
 * prop that has gone missing, a puzzle edited after the round opened — that unit
 * is dead for the rest of the round. Until now the only levers were RESTART
 * (wipes all 60 units) and PURGE (wipes the event), so one stuck team was never
 * a small problem: it was an all-or-nothing call taken live, in front of the
 * room. This turns that into a five-second fix.
 *
 * Three things it deliberately does NOT do:
 *
 * - It never downgrades a SOLVED link. Un-solving would silently retract points
 *   the ledger has already granted, which is the one thing an operator must not
 *   be able to do by accident.
 * - It never clears wrong-answer penalties. Those are already immutable ledger
 *   rows; forgiving them would change a *score*, and scores are what the ranking
 *   is built from. This changes *state* only.
 * - It touches no other unit, no other link, and not the round clock.
 *
 * The state change is recorded twice: a `MANUAL_ADJUSTMENT` row at `delta: 0`
 * in the unit's own ledger, so the chain of custody can explain how this unit
 * got past a link it never solved, and an `audit_logs` row naming the operator.
 * `delta: 0` is the point — this repairs progression, it does not award points.
 */
export async function unlockPuzzleForTeam(input: {
  adminId: number;
  teamId: number;
  puzzleCode: string;
}): Promise<{ outcome: RepairOutcome; message: string }> {
  const { adminId, teamId } = input;
  const puzzleCode = input.puzzleCode.trim().toUpperCase();
  const now = new Date();

  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) {
    return { outcome: "TEAM_UNKNOWN", message: `No unit with id ${teamId}.` };
  }

  /*
    `code` is unique per round rather than globally (`uq_puzzles_round_code`), so
    this resolves to exactly one row in practice — Round 01 is P1…P7, Round 02 is
    S1…S8 + LAST. It is still checked rather than assumed: silently opening the
    wrong round's link would be worse than refusing to act.
  */
  const matches = await db
    .select({
      id: puzzles.id,
      code: puzzles.code,
      roundId: puzzles.roundId,
      title: puzzles.title,
    })
    .from(puzzles)
    .where(eq(puzzles.code, puzzleCode));
  if (matches.length === 0) {
    return { outcome: "PUZZLE_UNKNOWN", message: `No link with code ${puzzleCode}.` };
  }
  if (matches.length > 1) {
    return {
      outcome: "PUZZLE_AMBIGUOUS",
      message: `${puzzleCode} exists in more than one round — refusing to guess.`,
    };
  }
  const puzzle = matches[0]!;

  const result = await db.transaction(
    async (tx): Promise<{ outcome: RepairOutcome; message: string }> => {
      // Same row-lock pattern as `submitAnswer`, so a repair cannot interleave
      // with the unit's own submission on the link being opened.
      const locked = await tx.execute(
        sql`select id, status from team_puzzle_progress
            where team_id = ${teamId} and puzzle_id = ${puzzle.id}
            for update`,
      );
      const progress = (locked.rows[0] ?? null) as unknown as {
        id: number;
        status: "LOCKED" | "UNLOCKED" | "SOLVED";
      } | null;

      if (progress?.status === "SOLVED") {
        return {
          outcome: "ALREADY_SOLVED",
          message: `${team.name} has already solved ${puzzle.code} — nothing to open.`,
        };
      }
      if (progress?.status === "UNLOCKED") {
        return {
          outcome: "ALREADY_OPEN",
          message: `${puzzle.code} is already open for ${team.name}.`,
        };
      }

      if (progress) {
        await tx
          .update(teamPuzzleProgress)
          .set({ status: "UNLOCKED", unlockedAt: now })
          .where(eq(teamPuzzleProgress.id, progress.id));
      } else {
        await tx
          .insert(teamPuzzleProgress)
          .values({ teamId, puzzleId: puzzle.id, status: "UNLOCKED", unlockedAt: now })
          .onConflictDoNothing();
      }

      await tx.insert(scoreEvents).values({
        teamId,
        roundId: puzzle.roundId,
        puzzleId: puzzle.id,
        type: "MANUAL_ADJUSTMENT",
        delta: 0,
        meta: { reason: "OPERATOR_UNLOCK", code: puzzle.code, adminId },
      });

      return {
        outcome: "UNLOCKED",
        message: `${puzzle.code} opened for ${team.name}. No points awarded — this repairs progression only.`,
      };
    },
  );

  // Only a real change is audited; a no-op refusal would just be noise in a
  // trail the operator has to read quickly.
  if (result.outcome === "UNLOCKED") {
    await logAudit({
      actorType: "ADMIN",
      actorId: adminId,
      action: "team.puzzle.unlock",
      entity: "team",
      entityId: String(teamId),
      meta: {
        teamName: team.name,
        code: puzzle.code,
        puzzleId: puzzle.id,
        roundId: puzzle.roundId,
      },
    });
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Admin oversight queries                                                      */
/* -------------------------------------------------------------------------- */

export interface AdminTeamOverviewRow {
  id: number;
  name: string;
  isActive: boolean;
  scoreR1: number;
  solvedR1: number;
  currentR1: string | null;
  finalRank: number | null;
  qualified: boolean | null;
  scoreR2: number;
  solvedR2: number;
  voted: boolean;
}

export async function adminTeamsOverview(): Promise<AdminTeamOverviewRow[]> {
  const rows = await db.execute(sql`
    with r1 as (select id from rounds where code = 'ROUND_1'),
         r2 as (select id from rounds where code = 'ROUND_2')
    select
      t.id,
      t.name,
      t.is_active,
      coalesce((select sum(se.delta) from score_events se
                where se.team_id = t.id and se.round_id in (select id from r1)), 0)::int as score_r1,
      coalesce((select count(*) from team_puzzle_progress pp
                join puzzles p on p.id = pp.puzzle_id
                where pp.team_id = t.id and pp.status = 'SOLVED'
                  and p.round_id in (select id from r1)), 0)::int as solved_r1,
      (select p2.code from team_puzzle_progress pp
        join puzzles p2 on p2.id = pp.puzzle_id
        where pp.team_id = t.id and pp.status = 'UNLOCKED'
          and p2.round_id in (select id from r1)
        order by p2.order_index limit 1) as current_r1,
      (select rp.final_rank from round_participations rp
        where rp.team_id = t.id and rp.round_id in (select id from r1)) as final_rank,
      (select rp.qualified from round_participations rp
        where rp.team_id = t.id and rp.round_id in (select id from r1)) as qualified,
      coalesce((select sum(se2.delta) from score_events se2
                where se2.team_id = t.id and se2.round_id in (select id from r2)), 0)::int as score_r2,
      coalesce((select count(*) from team_puzzle_progress pp2
                join puzzles p3 on p3.id = pp2.puzzle_id
                where pp2.team_id = t.id and pp2.status = 'SOLVED'
                  and p3.round_id in (select id from r2)), 0)::int as solved_r2,
      exists(select 1 from culprit_votes cv where cv.team_id = t.id) as voted
    from teams t
    order by t.name
  `);

  return (rows.rows as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    isActive: Boolean(row.is_active),
    scoreR1: Number(row.score_r1),
    solvedR1: Number(row.solved_r1),
    currentR1: (row.current_r1 as string | null) ?? null,
    finalRank: row.final_rank === null ? null : Number(row.final_rank),
    qualified: row.qualified === null ? null : Boolean(row.qualified),
    scoreR2: Number(row.score_r2),
    solvedR2: Number(row.solved_r2),
    voted: Boolean(row.voted),
  }));
}

/** Admin-only vote audit view (includes the correct culprit marker). */
export async function adminVotesOverview() {
  const voteRows = await db
    .select({
      teamId: culpritVotes.teamId,
      suspectCode: culpritVotes.suspectCode,
      createdAt: culpritVotes.createdAt,
      teamName: teams.name,
    })
    .from(culpritVotes)
    .innerJoin(teams, eq(teams.id, culpritVotes.teamId));

  const distribution = SUSPECTS.map((suspect) => ({
    suspect,
    count: voteRows.filter((v) => v.suspectCode === suspect.code).length,
  }));

  return {
    correctSuspectCode: CORRECT_SUSPECT_CODE,
    total: voteRows.length,
    distribution,
    votes: voteRows
      .map((v) => ({
        teamId: v.teamId,
        teamName: v.teamName,
        suspectCode: v.suspectCode,
        suspectName:
          SUSPECTS.find((s) => s.code === v.suspectCode)?.name ?? v.suspectCode,
        isCorrect: v.suspectCode === CORRECT_SUSPECT_CODE,
        createdAt: v.createdAt.toISOString(),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  };
}
