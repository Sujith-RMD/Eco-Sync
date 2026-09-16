/**
 * Pure game rules — the single source of truth for normalization, penalties,
 * time bonus, and ranking/tie-break logic.
 *
 * This module is intentionally free of database and Next.js imports so the
 * engine (server) and the test-suite (node) can both consume it.
 */

/* -------------------------------------------------------------------------- */
/* Answer normalization (spec §9)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Normalizes a submitted answer: Unicode NFKC, collapse internal whitespace,
 * trim, uppercase. Deliberately conservative — "3 048" must NOT become
 * "3048"; unrelated answers must never become valid.
 */
export function normalizeAnswer(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim().toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Penalties (spec §10, §13)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Wrong-answer deduction for one attempt, honoring the per-puzzle cap.
 * Returns 0 for the first 2 wrong attempts (grace period).
 * Returns 0 once the cap is already reached.
 */
export function wrongPenaltyForAttempt(
  penaltyAlreadyApplied: number,
  perAttemptPenalty: number,
  capPerPuzzle: number,
  wrongAttempts: number,
): number {
  // First 2 wrong attempts per puzzle are penalty-free.
  if (wrongAttempts < 2) return 0;
  const remaining = Math.max(0, capPerPuzzle - penaltyAlreadyApplied);
  return Math.min(perAttemptPenalty, remaining);
}

/* -------------------------------------------------------------------------- */
/* Time bonus (spec §7)                                                        */
/* -------------------------------------------------------------------------- */

/** +2 points for each FULL minute remaining. */
export function timeBonusPoints(
  remainingSeconds: number,
  perFullMinute: number,
): number {
  if (remainingSeconds <= 0) return 0;
  return Math.floor(remainingSeconds / 60) * perFullMinute;
}

/* -------------------------------------------------------------------------- */
/* Round 1 ranking & tie-breaks (spec §14)                                     */
/* -------------------------------------------------------------------------- */

export interface StandingInput {
  teamId: number;
  teamName: string;
  score: number;
  /** Server timestamp of the team's final puzzle solve; null if unfinished. */
  finishedAt: Date | null;
  solvedCount: number;
  totalWrongPenalty: number;
  totalHints: number;
}

export interface RankedStanding extends StandingInput {
  rank: number;
}

/**
 * Tie-break order (as supplied for the event):
 *  1. Higher score.
 *  2. Earlier finish time (teams that complete the round beat those who
 *     did not; among unfinished teams the deeper solve count wins).
 *  3. Fewer wrong-answer penalty points.
 *  4. Fewer hints used.
 *  5. Stable team id (registration order) — fully deterministic.
 */
export function rankStandings(rows: StandingInput[]): RankedStanding[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    if (a.finishedAt && b.finishedAt) {
      const diff = a.finishedAt.getTime() - b.finishedAt.getTime();
      if (diff !== 0) return diff;
    } else if (a.finishedAt && !b.finishedAt) {
      return -1;
    } else if (!a.finishedAt && b.finishedAt) {
      return 1;
    } else if (b.solvedCount !== a.solvedCount) {
      return b.solvedCount - a.solvedCount;
    }

    if (a.totalWrongPenalty !== b.totalWrongPenalty) {
      return a.totalWrongPenalty - b.totalWrongPenalty;
    }
    if (a.totalHints !== b.totalHints) return a.totalHints - b.totalHints;
    return a.teamId - b.teamId;
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * Round 2 ranking: earliest final-code solve wins; unfinished teams rank by
 * progression depth, then score, then stable team id.
 */
export function rankRound2<
  T extends {
    teamId: number;
    finishedAt: Date | null;
    solvedCount: number;
    score: number;
  },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.finishedAt && b.finishedAt) {
      const diff = a.finishedAt.getTime() - b.finishedAt.getTime();
      if (diff !== 0) return diff;
    } else if (a.finishedAt && !b.finishedAt) {
      return -1;
    } else if (!a.finishedAt && b.finishedAt) {
      return 1;
    }
    if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
    if (b.score !== a.score) return b.score - a.score;
    return a.teamId - b.teamId;
  });
}
