/**
 * Read-only proof that the per-puzzle answer box reaches the client payload.
 *
 * Prints, for every Round 1 puzzle, the `answerInput` that `engine.ts` attaches
 * to the snapshot — i.e. exactly what `round-console.tsx` feeds into the
 * <input>. Then, if a real team already has its bootstrap rows, calls
 * `getTeamRoundSnapshot` and re-prints from the live payload so the two cannot
 * disagree.
 *
 * Writes nothing. The only statements inside `getTeamRoundSnapshot` that touch
 * the DB are two `onConflictDoNothing` bootstraps, and those are skipped here
 * unless the rows are already present.
 */
import "dotenv/config";

import { ROUND1_PUZZLES, answerInputFor } from "@/server/game/catalogue";
import { getTeamRoundSnapshot } from "@/server/game/engine";
import { db } from "@/db";
import { puzzles, roundParticipations, rounds, teamPuzzleProgress, teams } from "@/db/schema";
import { and, eq } from "drizzle-orm";

async function main() {
  console.log("=== catalogue (answerInputFor) ===");
  for (const puzzle of ROUND1_PUZZLES) {
    const input = answerInputFor(puzzle.code);
    console.log(
      `  ${puzzle.code.padEnd(4)} placeholder=${JSON.stringify(input.placeholder).padEnd(24)} ` +
        `maxLength=${String(input.maxLength).padEnd(4)} lettersOnly=${input.lettersOnly}`,
    );
  }

  // A team that already played R1, so the bootstraps in the snapshot getter are
  // genuine no-ops rather than new rows.
  const team = await db.query.teams.findFirst({
    where: eq(teams.name, "TEAM#8210"),
  });
  const round = await db.query.rounds.findFirst({
    where: eq(rounds.code, "ROUND_1"),
  });
  if (!team || !round) {
    console.log("\n(no TEAM#8210 / ROUND_1 row — skipping the live-payload check)");
    return;
  }

  const participation = await db.query.roundParticipations.findFirst({
    where: and(
      eq(roundParticipations.teamId, team.id),
      eq(roundParticipations.roundId, round.id),
    ),
  });
  const firstPuzzle = await db.query.puzzles.findFirst({
    where: and(eq(puzzles.roundId, round.id), eq(puzzles.orderIndex, 1)),
  });
  const progress = firstPuzzle
    ? await db.query.teamPuzzleProgress.findFirst({
        where: and(
          eq(teamPuzzleProgress.teamId, team.id),
          eq(teamPuzzleProgress.puzzleId, firstPuzzle.id),
        ),
      })
    : null;

  console.log(
    `\n=== live payload — ${team.name} / ROUND_1 (status ${round.status}) ===`,
  );
  console.log(
    `  bootstrap rows present: participation=${Boolean(participation)} p1Progress=${Boolean(progress)}`,
  );
  if (!participation || !progress) {
    console.log("  (rows missing — skipping, so nothing is written)");
    return;
  }

  const snapshot = await getTeamRoundSnapshot(team.id, team.name, "ROUND_1");
  if (snapshot.kind !== "ready") {
    console.log(`  snapshot kind = ${snapshot.kind} — no puzzle payload to inspect`);
    return;
  }
  for (const puzzle of snapshot.snapshot.puzzles) {
    console.log(
      `  ${puzzle.code.padEnd(4)} placeholder=${JSON.stringify(puzzle.answerInput.placeholder).padEnd(24)} ` +
        `maxLength=${String(puzzle.answerInput.maxLength).padEnd(4)} ` +
        `lettersOnly=${puzzle.answerInput.lettersOnly}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
