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
    durationMinutes: 45,
    puzzleCount: 10,
    easyPoints: 75,
    mediumPoints: 100,
    hardPoints: 125,
    finalPuzzlePoints: 150,
    qualifyingTeams: 15,
  },
  round2: {
    code: "ROUND_2" as const,
    durationMinutes: 60,
    /** Visible chain puzzles: S1, S2, S3, S4, S5, S6 and LAST. */
    puzzleCount: 7,
    winningTeams: 3,
  },
  scoring: {
    hintPenalty: 50,
    wrongAnswerPenalty: 25,
    wrongAnswerPenaltyCapPerPuzzle: 50,
    timeBonusPerFullMinute: 2,
    maxRound1Score: 1065,
    /** Server-enforced submission cooldown after a wrong answer. */
    lockoutSeconds: 10,
  },
} as const;
