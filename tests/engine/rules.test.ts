import { describe, expect, it } from "vitest";
import {
  normalizeAnswer,
  rankRound2,
  rankStandings,
  timeBonusPoints,
  wrongPenaltyForAttempt,
  type StandingInput,
} from "@/server/game/rules";
import { GAME_CONSTANTS } from "@/server/game/constants";
import { ROUND1_PUZZLES } from "@/server/game/catalogue";

const { scoring, round1 } = GAME_CONSTANTS;

/* spec §9 — normalization */
describe("answer normalization", () => {
  it("accepts case and surrounding-whitespace variants", () => {
    expect(normalizeAnswer("  nightowl ")).toBe("NIGHTOWL");
    expect(normalizeAnswer("LiBrArY")).toBe("LIBRARY");
    expect(normalizeAnswer("\t greenwash \n")).toBe("GREENWASH");
    expect(normalizeAnswer("  truth  ")).toBe("TRUTH");
  });

  it("never becomes permissive enough to accept unrelated answers", () => {
    expect(normalizeAnswer("3 048")).not.toBe("3048");
    expect(normalizeAnswer("usb hub")).not.toBe("USB");
    expect(normalizeAnswer("night owl extra")).not.toBe("NIGHTOWL");
  });
});

/* spec §10 / §13 — penalties */
describe("wrong-answer penalties", () => {
  it("first 2 wrong attempts are free, then −25 per wrong answer until the −50 per-puzzle cap", () => {
    let applied = 0;
    const sequence: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const deduction = wrongPenaltyForAttempt(
        applied,
        scoring.wrongAnswerPenalty,
        scoring.wrongAnswerPenaltyCapPerPuzzle,
        i,
      );
      sequence.push(deduction);
      applied += deduction;
    }
    // Attempts 0,1: free. Attempts 2–3: −25 each (cap reached at 50). Attempt 4+: cap hit.
    expect(sequence).toEqual([0, 0, 25, 25, 0, 0, 0, 0]);
    expect(applied).toBe(scoring.wrongAnswerPenaltyCapPerPuzzle);
  });
});

/* spec §7 — scoring model */
describe("scoring model", () => {
  it("awards +2 per FULL minute remaining only", () => {
    expect(timeBonusPoints(2400, scoring.timeBonusPerFullMinute)).toBe(80);
    expect(timeBonusPoints(599, scoring.timeBonusPerFullMinute)).toBe(18);
    expect(timeBonusPoints(59, scoring.timeBonusPerFullMinute)).toBe(0);
    expect(timeBonusPoints(0, scoring.timeBonusPerFullMinute)).toBe(0);
    expect(timeBonusPoints(-30, scoring.timeBonusPerFullMinute)).toBe(0);
  });

  it("theoretical Round 1 maximum equals the configured ceiling", () => {
    const base = ROUND1_PUZZLES.reduce((sum, puzzle) => sum + puzzle.points, 0);
    const bonus = timeBonusPoints(
      round1.durationMinutes * 60,
      scoring.timeBonusPerFullMinute,
    );
    // Base is 975 (5×75 easy + 2×100 medium + 2×125 hard + 150 final)
    // Plus 80 time bonus (40 min × 2 pts/min)
    expect(base + bonus).toBe(1055);
    expect(base + bonus).toBe(scoring.maxRound1Score);
  });

  it("computes a simulated full run from pure rules only", () => {
    // Solves every Round 1 link, two wrongs on one puzzle (3rd attempt onward penalized),
    // one hint, finishes with 12:30 still on the clock.
    const solvedPoints = ROUND1_PUZZLES.reduce((sum, puzzle) => sum + puzzle.points, 0);
    let score = solvedPoints;
    let penaltyApplied = 0;
    // Simulate 4 wrong attempts: first 2 free, next 2 charged (−25 each)
    for (let i = 0; i < 4; i += 1) {
      const d = wrongPenaltyForAttempt(penaltyApplied, 25, 50, i);
      score -= d;
      penaltyApplied += d;
    }
    score -= scoring.hintPenalty;
    score += timeBonusPoints(750, scoring.timeBonusPerFullMinute);
    expect(score).toBe(solvedPoints - 50 - 30 + 24);
  });
});

/* spec §14 — qualification ranking & tie-breaks */
describe("ranking and tie-breaks", () => {
  const base: StandingInput = {
    teamId: 0,
    teamName: "",
    score: 0,
    finishedAt: null,
    solvedCount: 0,
    totalWrongPenalty: 0,
    totalHints: 0,
  };
  const T = (partial: Partial<StandingInput> & { teamId: number }): StandingInput => ({
    ...base,
    teamName: `TEAM#${partial.teamId}`,
    ...partial,
  });

  it("ranks by score, then finish time, then penalties, then hints", () => {
    const ranked = rankStandings([
      T({ teamId: 1, score: 700, finishedAt: new Date("2026-01-01T10:00:00Z"), solvedCount: 7 }),
      T({ teamId: 2, score: 700, finishedAt: new Date("2026-01-01T09:30:00Z"), solvedCount: 7 }),
      T({ teamId: 3, score: 700, solvedCount: 6, totalWrongPenalty: 30 }),
      T({ teamId: 4, score: 700, solvedCount: 6, totalWrongPenalty: 20 }),
      T({ teamId: 5, score: 1130, finishedAt: new Date("2026-01-01T11:00:00Z"), solvedCount: 10 }),
    ]);
    expect(ranked.map((r) => r.teamId)).toEqual([5, 2, 1, 4, 3]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("finished teams always outrank unfinished ones on equal score", () => {
    const ranked = rankStandings([
      T({ teamId: 1, score: 100, solvedCount: 1 }),
      T({ teamId: 2, score: 100, solvedCount: 1, finishedAt: new Date() }),
    ]);
    expect(ranked[0]!.teamId).toBe(2);
  });

  it("Round 2 ranks by finish, then depth, then score", () => {
    const ranked = rankRound2([
      { teamId: 1, name: "A", score: 500, solvedCount: 10, finishedAt: null },
      { teamId: 2, name: "B", score: 300, solvedCount: 12, finishedAt: new Date("2026-01-01T12:00:00Z") },
      { teamId: 3, name: "C", score: 900, solvedCount: 12, finishedAt: new Date("2026-01-01T11:00:00Z") },
      { teamId: 4, name: "D", score: 600, solvedCount: 11, finishedAt: null },
    ]);
    expect(ranked.map((r) => r.teamId)).toEqual([3, 2, 4, 1]);
  });
});
