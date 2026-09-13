import { UNARMED_SENTINEL } from "./catalogue";

/**
 * Pure half of the content guard: recognise a placeholder answer and explain it.
 *
 * Kept free of `server-only` and of the database so the rule that decides
 * whether 60 teams can play a round is the rule under test.
 */

/** Any `__LIKE_THIS__` value counts as un-armed, not just the current marker. */
const PLACEHOLDER_SHAPE = /^__[A-Z0-9_-]+__$/;

export function isUnarmedAnswer(answer: string): boolean {
  const normalized = answer.trim().toUpperCase();
  return normalized === UNARMED_SENTINEL || PLACEHOLDER_SHAPE.test(normalized);
}

export interface UnarmedPuzzle {
  code: string;
  orderIndex: number;
}

/**
 * Operator-facing refusal. Positions are stated because the position is what
 * makes it urgent: a placeholder at 6 of 8 strands the final code and the vote
 * behind it, while one at 8 of 8 strands only itself.
 */
export function describeUnarmed(
  unarmed: UnarmedPuzzle[],
  totalPositions: number,
  roundLabel: string,
): string {
  const list = unarmed
    .map((entry) => `${entry.code} (position ${entry.orderIndex} of ${totalPositions})`)
    .join(", ");
  const firstPosition = Math.min(...unarmed.map((entry) => entry.orderIndex));
  const stranded = Math.max(0, totalPositions - firstPosition);
  const consequence =
    stranded > 0
      ? `Every link behind it (${stranded} of ${totalPositions}) would be unreachable, including the final code and the culprit vote.`
      : `The final code itself is un-armed, so the round could never be completed.`;
  return [
    `${roundLabel} cannot be opened: ${unarmed.length} link${unarmed.length === 1 ? "" : "s"} still ${
      unarmed.length === 1 ? "has" : "have"
    } a placeholder answer — ${list}.`,
    consequence,
    "Arm those answers in the database, then start the round.",
  ].join(" ");
}
