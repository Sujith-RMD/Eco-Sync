import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  culpritVotes,
  puzzleAttempts,
  puzzles,
  roundParticipations,
  rounds,
  scoreEvents,
  teamPuzzleProgress,
  teams,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { CORRECT_SUSPECT_CODE, SUSPECTS } from "@/server/game/catalogue";
import { AdminShell } from "@/components/admin/admin-shell";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { toEventClock, toEventDay } from "@/lib/utils/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team Detail — Command Deck",
};

/** Event-local wall clock (IST). Instants remain UTC in the database. */
function fmt(date: Date | null | undefined): string {
  return toEventClock(date);
}

export default async function AdminTeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { admin } = await requireAdmin();
  const { id } = await params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId)) notFound();

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { id: true, name: true, isActive: true, createdAt: true },
  });
  if (!team) notFound();

  const [progression, attempts, events, parts, vote] = await Promise.all([
    db
      .select({
        roundCode: rounds.code,
        orderIndex: puzzles.orderIndex,
        code: puzzles.code,
        title: puzzles.title,
        points: puzzles.points,
        status: teamPuzzleProgress.status,
        wrongAttempts: teamPuzzleProgress.wrongAttempts,
        wrongPenaltyPoints: teamPuzzleProgress.wrongPenaltyPoints,
        hintsUsed: teamPuzzleProgress.hintsUsed,
        solvedAt: teamPuzzleProgress.solvedAt,
      })
      .from(teamPuzzleProgress)
      .innerJoin(puzzles, eq(puzzles.id, teamPuzzleProgress.puzzleId))
      .innerJoin(rounds, eq(rounds.id, puzzles.roundId))
      .where(eq(teamPuzzleProgress.teamId, teamId))
      .orderBy(rounds.code, puzzles.orderIndex),
    db
      .select({
        code: puzzles.code,
        submittedAnswer: puzzleAttempts.submittedAnswer,
        isCorrect: puzzleAttempts.isCorrect,
        penaltyApplied: puzzleAttempts.penaltyApplied,
        createdAt: puzzleAttempts.createdAt,
      })
      .from(puzzleAttempts)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAttempts.puzzleId))
      .where(eq(puzzleAttempts.teamId, teamId))
      .orderBy(desc(puzzleAttempts.createdAt))
      .limit(60),
    db
      .select({
        type: scoreEvents.type,
        delta: scoreEvents.delta,
        createdAt: scoreEvents.createdAt,
        roundCode: rounds.code,
        puzzleCode: puzzles.code,
      })
      .from(scoreEvents)
      .leftJoin(rounds, eq(rounds.id, scoreEvents.roundId))
      .leftJoin(puzzles, eq(puzzles.id, scoreEvents.puzzleId))
      .where(eq(scoreEvents.teamId, teamId))
      .orderBy(desc(scoreEvents.createdAt))
      .limit(100),
    db
      .select({
        code: rounds.code,
        qualified: roundParticipations.qualified,
        finalScore: roundParticipations.finalScore,
        finalRank: roundParticipations.finalRank,
        finishedAt: roundParticipations.finishedAt,
      })
      .from(roundParticipations)
      .innerJoin(rounds, eq(rounds.id, roundParticipations.roundId))
      .where(eq(roundParticipations.teamId, teamId)),
    db.query.culpritVotes.findFirst({
      where: eq(culpritVotes.teamId, teamId),
    }),
  ]);

  const scoreTotal = events.reduce((acc, event) => acc + event.delta, 0);
  const voteSuspect = vote
    ? SUSPECTS.find((s) => s.code === vote.suspectCode)
    : null;

  return (
    <AdminShell
      active="teams"
      eyebrow={`Unit file // ${team.name}`}
      title={team.name}
      adminName={admin.username}
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel title="Identity">
            <dl className="space-y-2 font-mono text-[12px]">
              <div className="flex items-center justify-between">
                <dt className="text-dim">Account</dt>
                <dd>
                  <StatusPill
                    tone={team.isActive ? "ok" : "alert"}
                    label={team.isActive ? "active" : "frozen"}
                    staticDot
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-dim">Registered</dt>
                <dd className="text-mist">{toEventDay(team.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-dim">Ledger total</dt>
                <dd className="tabular-nums text-ink">{scoreTotal}</dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-line/60 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
              Access codes are stored as hashes and never displayed.
            </p>
          </Panel>

          <Panel title="Participation">
            {parts.length === 0 ? (
              <p className="font-mono text-[12px] text-dim">No round participation yet.</p>
            ) : (
              <dl className="space-y-2 font-mono text-[12px]">
                {parts.map((part) => (
                  <div key={part.code} className="flex items-center justify-between">
                    <dt className="text-dim">{part.code}</dt>
                    <dd className="text-mist">
                      {part.finalRank !== null ? `#${part.finalRank} · ` : ""}
                      {part.finalScore !== null ? `${part.finalScore} pts · ` : ""}
                      {part.qualified === true
                        ? "QUALIFIED"
                        : part.qualified === false
                          ? "ELIMINATED"
                          : part.finishedAt
                            ? `finished ${fmt(part.finishedAt)}`
                            : "in progress"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          <Panel title="Culprit vote">
            {vote ? (
              <div className="space-y-2 font-mono text-[12px]">
                <p className="text-ink">{voteSuspect?.name ?? vote.suspectCode}</p>
                <p className="text-dim">sealed {fmt(vote.createdAt)}</p>
                <StatusPill
                  tone={vote.suspectCode === CORRECT_SUSPECT_CODE ? "ok" : "alert"}
                  label={vote.suspectCode === CORRECT_SUSPECT_CODE ? "correct verdict" : "wrong verdict"}
                  staticDot
                />
              </div>
            ) : (
              <p className="font-mono text-[12px] text-dim">No vote on record.</p>
            )}
          </Panel>
        </div>

        <Panel title="Progression">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] sm:min-w-[640px] sm:text-[12px]">
              <thead>
                <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.12em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">
                    Round
                  </th>
                  <th className="px-2 py-2 font-medium sm:px-3">Puzzle</th>
                  <th className="px-2 py-2 font-medium sm:px-3">Status</th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">
                    Attempts
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">
                    Penalty
                  </th>
                  <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">
                    Hints
                  </th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">
                    Solved
                  </th>
                </tr>
              </thead>
              <tbody>
                {progression.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-dim">
                      No progression recorded.
                    </td>
                  </tr>
                ) : (
                  progression.map((row) => (
                    <tr key={`${row.roundCode}-${row.code}`} className="border-b border-line/40">
                      <td className="hidden px-3 py-2 text-dim sm:table-cell">
                        {row.roundCode === "ROUND_1" ? "R1" : "R2"}
                      </td>
                      <td className="px-2 py-2 text-ink sm:px-3">
                        {row.code} <span className="text-dim">· {row.title}</span>
                      </td>
                      <td className="px-2 py-2 sm:px-3">
                        <StatusPill
                          tone={row.status === "SOLVED" ? "ok" : row.status === "UNLOCKED" ? "warn" : "muted"}
                          label={row.status}
                          staticDot
                        />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-mist sm:px-3">
                        {row.wrongAttempts}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist lg:table-cell">
                        {row.wrongPenaltyPoints > 0 ? `−${row.wrongPenaltyPoints}` : "0"}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums text-mist lg:table-cell">
                        {row.hintsUsed}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-mist sm:px-3">
                        {fmt(row.solvedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Score ledger">
            <div className="max-h-80 overflow-auto">
              <table className="w-full font-mono text-[11px] sm:text-[12px]">
                <thead className="sticky top-0 bg-abyss-900">
                  <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.1em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
                    <th className="px-2 py-2 font-medium sm:px-3">Time</th>
                    <th className="px-2 py-2 font-medium sm:px-3">Event</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">
                      Ref
                    </th>
                    <th className="px-2 py-2 text-right font-medium sm:px-3">
                      Delta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-dim">
                        Ledger empty.
                      </td>
                    </tr>
                  ) : (
                    events.map((event, index) => (
                      <tr key={index} className="border-b border-line/40">
                        <td className="px-2 py-2 tabular-nums text-dim sm:px-3">
                          {fmt(event.createdAt)}
                        </td>
                        <td className="px-2 py-2 break-words text-mist sm:px-3">
                          {event.type}
                          <span className="text-dim sm:hidden">
                            {" · "}
                            {event.puzzleCode ?? event.roundCode ?? "—"}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2 break-words text-dim sm:table-cell">
                          {event.puzzleCode ?? event.roundCode ?? "—"}
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums sm:px-3 ${
                            event.delta >= 0 ? "text-acid" : "text-alert"
                          }`}
                        >
                          {event.delta >= 0 ? `+${event.delta}` : event.delta}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Attempt log">
            <div className="max-h-80 overflow-auto">
              <table className="w-full font-mono text-[11px] sm:text-[12px]">
                <thead className="sticky top-0 bg-abyss-900">
                  <tr className="border-b border-line/70 text-left text-[9px] uppercase tracking-[0.1em] text-dim sm:text-[10px] sm:tracking-[0.22em]">
                    <th className="px-2 py-2 font-medium sm:px-3">Time</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">
                      Puzzle
                    </th>
                    <th className="px-2 py-2 font-medium sm:px-3">
                      Submission
                    </th>
                    <th className="px-2 py-2 font-medium sm:px-3">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-dim">
                        No attempts yet.
                      </td>
                    </tr>
                  ) : (
                    attempts.map((attempt, index) => (
                      <tr key={index} className="border-b border-line/40">
                        <td className="px-2 py-2 tabular-nums text-dim sm:px-3">
                          {fmt(attempt.createdAt)}
                        </td>
                        <td className="hidden px-3 py-2 text-ink sm:table-cell">
                          {attempt.code}
                        </td>
                        <td className="max-w-[8rem] truncate px-2 py-2 text-mist sm:max-w-[12rem] sm:px-3">
                          <span className="text-dim sm:hidden">
                            {attempt.code} ·{" "}
                          </span>
                          {attempt.submittedAnswer}
                        </td>
                        <td className="px-2 py-2 sm:px-3">
                          {attempt.isCorrect ? (
                            <StatusPill tone="ok" label="correct" staticDot />
                          ) : (
                            <StatusPill
                              tone="alert"
                              label={`wrong −${attempt.penaltyApplied}`}
                              staticDot
                            />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}
