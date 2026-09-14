/**
 * Pure half of the content guard: recognise a placeholder answer and explain it.
 *
 * Kept free of `server-only` and of the database so the rule that decides
 * whether 60 teams can play a round is the rule under test. That is also why
 * `UNARMED_SENTINEL` is declared here rather than in `./catalogue`: the
 * catalogue is guarded now, and importing it would drag that guard in behind
 * the one module the tests have to be able to load.
 */

/**
 * The value a link carries until its answer is armed. Deliberately long and
 * unmistakable so no team can ever type it, and the guard below treats it —
 * like any other `__LIKE_THIS__` value — as un-armed.
 */
export const UNARMED_SENTINEL = "__UNARMED__";

/** Any `__LIKE_THIS__` value counts as un-armed, not just the current marker. */
const PLACEHOLDER_SHAPE = /^__[A-Z0-9_-]+__$/;

export function isUnarmedAnswer(answer: string): boolean {
  const normalized = answer.trim().toUpperCase();
  /*
    An empty answer is un-armed even though it is not a placeholder. The submit
    action rejects `answer.length === 0`, so the empty string can never be typed
    from the UI — meaning an empty expected answer is not a free solve, it is a
    link nobody can ever pass, which strands the whole chain behind it exactly
    the way a placeholder does. The guard exists to catch that class of content,
    so it has to inspect the one input that is neither a sentinel nor a shape.
  */
  if (normalized.length === 0) return true;
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
