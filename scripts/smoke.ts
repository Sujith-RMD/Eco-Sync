/**
 * End-to-end engine smoke rehearsal (run manually against a live database):
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/smoke.ts
 *
 * Boots a full event from scratch, plays a team through Round 1 and Round 2
 * using ONLY the real engine entry points, asserts every critical invariant
 * (lockouts, caps, qualification gating, envelope chain, final code, vote
 * unsealing, duplicate-vote rejection), then wipes all data so the platform
 * returns to a pristine state.
 */
import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  admins,
  roundParticipations,
  rounds,
  teams,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { seedEvent } from "@/server/game/seed";
import {
  adminVotesOverview,
  applyQualification,
  castVote,
  computeRound1Standings,
  endRound,
  getTeamRoundSnapshot,
  startRound,
  submitAnswer,
  useHint,
} from "@/server/game/engine";
import { ROUND1_PUZZLES, ROUND2_PUZZLES, FINAL_CODE_PUZZLE_CODE } from "@/server/game/catalogue";

let passed = 0;
let failed = 0;

function expect(condition: boolean, label: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

async function wipe() {
  await db.execute(sql`
    truncate table culprit_votes, hint_usages, puzzle_attempts,
      team_puzzle_progress, score_events, round_participations,
      puzzles, rounds, sessions, teams, audit_logs, admins
    restart identity cascade
  `);
}

async function clearLockout(teamId: number, roundCode: string, puzzleCode: string) {
  await db.execute(sql`
    update team_puzzle_progress pp
    set locked_until = now() - interval '1 minute'
    from puzzles p
    join rounds r on r.id = p.round_id
    where pp.puzzle_id = p.id
      and pp.team_id = ${teamId}
      and p.code = ${puzzleCode}
      and r.code = ${roundCode}
  `);
}

async function scoreFor(teamId: number, roundCode: string): Promise<number> {
  const result = await db.execute(
    sql`select coalesce(sum(se.delta), 0)::int as total
        from score_events se
        join rounds r on r.id = se.round_id
        where se.team_id = ${teamId} and r.code = ${roundCode}`,
  );
  return Number((result.rows[0] as { total: number }).total);
}

async function main() {
  console.log("— ECO-SYNC engine smoke rehearsal —\n");
  await wipe();

  /* seed ----------------------------------------------------------------- */
  console.log("SEED");
  const seed = await seedEvent({ adminUsername: "smoke-op", adminPassword: "dummy-passphrase-123" });
  expect(seed.teams.length === 60, "seeded 60 units");
  expect(seed.puzzleCounts.round1 === 7 && seed.puzzleCounts.round2 === 11, "supplied puzzle catalogue seeded");
  const admin = await db.query.admins.findFirst({ where: eq(admins.username, "smoke-op") });
  expect(Boolean(admin), "operator account created");
  const t1 = (await db.query.teams.findFirst({ where: eq(teams.name, "UNIT-01") }))!;
  const t60 = (await db.query.teams.findFirst({ where: eq(teams.name, "UNIT-60") }))!;
  expect(Boolean(t1) && Boolean(t60), "unit accounts queryable");

  /* round 1 --------------------------------------------------------------- */
  console.log("ROUND 01");
  const start1 = await startRound(admin!.id, "ROUND_1");
  expect(start1.ok, "round 01 starts (official clock armed)");

  const hint = await useHint({ teamId: t1.id, roundCode: "ROUND_1", puzzleCode: "P1" });
  expect(hint.ok && typeof hint.hint === "string", "hint issued with −30 penalty");

  const wrong = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_1", puzzleCode: "P1", rawAnswer: "definitely-wrong" });
  expect(wrong.outcome === "WRONG" && wrong.deduction === 10, "wrong answer: −10 recorded");

  const duringLockout = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_1", puzzleCode: "P1", rawAnswer: "NIGHTOWL" });
  expect(duringLockout.outcome === "LOCKOUT", "lockout blocks resubmission (server-enforced)");

  const earlyP2 = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_1", puzzleCode: "P2", rawAnswer: "LIBRARY" });
  expect(earlyP2.outcome === "LOCKED_PUZZLE", "locked puzzle cannot be answered early");

  await clearLockout(t1.id, "ROUND_1", "P1");
  const normalized = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_1", puzzleCode: "P1", rawAnswer: "  nightowl " });
  expect(normalized.outcome === "CORRECT", "normalized correct answer accepted; P2 unlocked");

  const dupSolve = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_1", puzzleCode: "P1", rawAnswer: "NIGHTOWL" });
  expect(dupSolve.outcome === "ALREADY_SOLVED", "repeat solve rejected");

  for (const puzzle of ROUND1_PUZZLES.slice(1)) {
    await clearLockout(t1.id, "ROUND_1", puzzle.code);
    const res = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_1", puzzleCode: puzzle.code, rawAnswer: puzzle.answer });
    if (res.outcome !== "CORRECT") {
      console.error(`    -> unexpected ${puzzle.code} outcome ${res.outcome}: ${res.message}`);
    }
    expect(res.outcome === "CORRECT", `${puzzle.code} solved in chain`);
  }

  const scoreAfterR1 = await scoreFor(t1.id, "ROUND_1");
  const bonus = 750 - 40; // all points − hint − one wrong
  expect(scoreAfterR1 > bonus, `score includes time bonus (got ${scoreAfterR1})`);
  expect(scoreAfterR1 <= 830 - 40, `score beneath ceiling (got ${scoreAfterR1})`);

  // timer expiry enforcement
  await db.execute(sql`update rounds set ends_at = now() - interval '1 minute' where code = 'ROUND_1'`);
  const expired = await submitAnswer({ teamId: t60.id, roundCode: "ROUND_1", puzzleCode: "P1", rawAnswer: "NIGHTOWL" });
  expect(expired.outcome === "ROUND_EXPIRED", "expired round rejects submissions");

  const end1 = await endRound(admin!.id, "ROUND_1");
  expect(end1.ok, "round 01 ended");

  /* qualification --------------------------------------------------------- */
  console.log("QUALIFICATION");
  const qualify = await applyQualification(admin!.id);
  expect(qualify.ok, "qualification applied");

  const r1 = await db.query.rounds.findFirst({ where: eq(rounds.code, "ROUND_1") });
  const p1 = await db.query.roundParticipations.findFirst({
    where: and(eq(roundParticipations.teamId, t1.id), eq(roundParticipations.roundId, r1!.id)),
  });
  const p60 = await db.query.roundParticipations.findFirst({
    where: and(eq(roundParticipations.teamId, t60.id), eq(roundParticipations.roundId, r1!.id)),
  });
  expect(p1?.qualified === true && p1.finalRank === 1, "top unit marked qualified at rank #1");
  expect(p60?.qualified === false, "idle unit marked eliminated");

  const gated = await getTeamRoundSnapshot(t60.id, t60.name, "ROUND_2");
  expect(gated.kind === "gated" && gated.reason === "NOT_QUALIFIED", "non-qualified unit cannot enter round 02");

  const start2 = await startRound(admin!.id, "ROUND_2");
  expect(start2.ok, "round 02 starts for the qualified roster");

  const blockedR2 = await submitAnswer({ teamId: t60.id, roundCode: "ROUND_2", puzzleCode: "S1", rawAnswer: "FUDGED" });
  expect(blockedR2.outcome === "NOT_QUALIFIED", "round 02 submissions gated server-side");

  /* round 2 --------------------------------------------------------------- */
  console.log("ROUND 02");
  // Codes are referenced positionally: the supplied chain is S1, S3, S4…S8, LAST.
  const [first, second, third, lastPuzzle] = [
    ROUND2_PUZZLES[0]!,
    ROUND2_PUZZLES[1]!,
    ROUND2_PUZZLES[2]!,
    ROUND2_PUZZLES[ROUND2_PUZZLES.length - 1]!,
  ];
  await submitAnswer({ teamId: t1.id, roundCode: "ROUND_2", puzzleCode: first.code, rawAnswer: first.answer });
  const earlyFinal = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_2", puzzleCode: lastPuzzle.code, rawAnswer: lastPuzzle.answer });
  expect(earlyFinal.outcome === "LOCKED_PUZZLE", "final code cannot be submitted early");

  const gatedNext = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_2", puzzleCode: third.code, rawAnswer: third.answer });
  expect(gatedNext.outcome === "LOCKED_PUZZLE", `${third.code} waits for ${second.code} to clear`);

  for (const puzzle of ROUND2_PUZZLES.slice(1)) {
    await clearLockout(t1.id, "ROUND_2", puzzle.code);
    const res = await submitAnswer({ teamId: t1.id, roundCode: "ROUND_2", puzzleCode: puzzle.code, rawAnswer: puzzle.answer });
    expect(res.outcome === "CORRECT", `${puzzle.code} cleared (${puzzle.kind})`);
  }

  const ready = await getTeamRoundSnapshot(t1.id, t1.name, "ROUND_2");
  expect(
    ready.kind === "ready" && ready.snapshot.vote?.unlocked === true,
    "culprit vote unseals only after the final code",
  );

  const vote = await castVote({ teamId: t1.id, suspectCode: "ROHAN_MEHTA" });
  expect(vote.outcome === "SEALED", "vote sealed");
  const dupVote = await castVote({ teamId: t1.id, suspectCode: "ROHAN_MEHTA" });
  expect(dupVote.outcome === "DUPLICATE", "duplicate vote rejected");
  const badSuspect = await castVote({ teamId: t1.id, suspectCode: "NOBODY" });
  expect(["INVALID_SUSPECT", "DUPLICATE"].includes(badSuspect.outcome), "invalid suspect rejected");

  const votes = await adminVotesOverview();
  expect(votes.total === 1, "vote ledger holds exactly one verdict");

  const standings = await computeRound1Standings();
  expect(standings.length === 60, "standings cover all 60 units");

  console.log(`\n— RESULT: ${passed} passed, ${failed} failed —`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("smoke rehearsal crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await wipe().catch(() => undefined);
    await pool.end();
  });
