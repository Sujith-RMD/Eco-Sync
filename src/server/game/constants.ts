/**
 * Official rule constants for ECO-SYNC: THE BREACH.
 *
 * These values contain no secrets, so this module is also importable from
 * the test-suite. Secret material (answers, hints, the culprit) lives in
 * `catalogue.ts`, which is server-only by import discipline.
 *
 * These come directly from the project specification documents. The game
 * engine (Phase 2) and scoring engine consume them — they are defined here
 * once so no rule is ever re-implemented in a component.
 */
export const GAME_CONSTANTS = {
  round1: {
    code: "ROUND_1" as const,
    durationMinutes: 40,
    puzzleCount: 7,
    pointsPerPuzzle: 100,
    finalPuzzlePoints: 150,
    qualifyingTeams: 15,
  },
  round2: {
    code: "ROUND_2" as const,
    durationMinutes: 75,
    /** Display total for standings and unit views. The chain itself is the
     *  database's; this is only the denominator printed next to it. */
    puzzleCount: 8,
    winningTeams: 3,
  },
  scoring: {
    hintPenalty: 30,
    wrongAnswerPenalty: 10,
    wrongAnswerPenaltyCapPerPuzzle: 50,
    timeBonusPerFullMinute: 2,
    maxRound1Score: 830,
    /** Server-enforced submission cooldown after a wrong answer. */
    lockoutSeconds: 30,
  },
} as const;
