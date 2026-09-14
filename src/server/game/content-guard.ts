import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { puzzles } from "@/db/schema";
import { isUnarmedAnswer, type UnarmedPuzzle } from "./unarmed";

/**
 * Database half of the content guard. The rule itself — what counts as an
 * un-armed answer, and what the operator is told — is pure and lives in
 * `./unarmed`; this module only reads the live chain and applies it.
 *
 * Why the guard runs at all: Round 2's chain unseals `orderIndex + 1` by exact
 * match, so a placeholder answer does not stall one link, it strands everything
 * behind it — the final code, and the culprit vote that code unseals. Opening
 * such a round gives 61 rooms a wall and no explanation.
 */
export async function auditRoundAnswers(
  roundId: number,
): Promise<{ unarmed: UnarmedPuzzle[]; total: number }> {
  const rows = await db
    .select({
      code: puzzles.code,
      orderIndex: puzzles.orderIndex,
      answer: puzzles.expectedAnswerNormalized,
    })
    .from(puzzles)
    .where(eq(puzzles.roundId, roundId))
    .orderBy(asc(puzzles.orderIndex));

  return {
    unarmed: rows
      .filter((row) => isUnarmedAnswer(row.answer))
      .map(({ code, orderIndex }) => ({ code, orderIndex })),
    total: rows.length,
  };
}
