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
  it("deducts −10 per wrong answer until the −50 per-puzzle cap", () => {
    let applied = 0;
    const sequence: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const deduction = wrongPenaltyForAttempt(
        applied,
        scoring.wrongAnswerPenalty,
        scoring.wrongAnswerPenaltyCapPerPuzzle,
      );
      sequence.push(deduction);
      applied += deduction;
    }
    expect(sequence).toEqual([10, 10, 10, 10, 10, 0, 0, 0]);
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

  it("theoretical Round 1 maximum equals the supplied 830", () => {
    const base =
      round1.pointsPerPuzzle * (round1.puzzleCount - 1) + round1.finalPuzzlePoints;
    const bonus = timeBonusPoints(
      round1.durationMinutes * 60,
      scoring.timeBonusPerFullMinute,
    );
    expect(base + bonus).toBe(830);
    expect(base + bonus).toBe(scoring.maxRound1Score);
  });

  it("computes a simulated full run from pure rules only", () => {
    // Solves all 7, two wrongs on one puzzle, one hint, finishes with 12:30 left.
    let score = ROUND1_PUZZLES.reduce((sum, puzzle) => sum + puzzle.points, 0);
    let penaltyApplied = 0;
    for (let i = 0; i < 2; i += 1) {
      const d = wrongPenaltyForAttempt(penaltyApplied, 10, 50);
      score -= d;
      penaltyApplied += d;
    }
    score -= scoring.hintPenalty;
    score += timeBonusPoints(750, scoring.timeBonusPerFullMinute);
    expect(score).toBe(750 - 20 - 30 + 24);
    expect(score).toBe(724);
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
    teamName: `UNIT-${partial.teamId}`,
    ...partial,
  });

  it("ranks by score, then finish time, then penalties, then hints", () => {
    const ranked = rankStandings([
      T({ teamId: 1, score: 700, finishedAt: new Date("2026-01-01T10:00:00Z"), solvedCount: 7 }),
      T({ teamId: 2, score: 700, finishedAt: new Date("2026-01-01T09:30:00Z"), solvedCount: 7 }),
      T({ teamId: 3, score: 700, solvedCount: 6, totalWrongPenalty: 30 }),
      T({ teamId: 4, score: 700, solvedCount: 6, totalWrongPenalty: 20 }),
      T({ teamId: 5, score: 830, finishedAt: new Date("2026-01-01T11:00:00Z"), solvedCount: 7 }),
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
