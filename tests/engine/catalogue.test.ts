import { describe, expect, it } from "vitest";
import {
  CORRECT_SUSPECT_CODE,
  FINAL_CODE_PUZZLE_CODE,
  ROUND1_PUZZLES,
  ROUND2_PUZZLES,
  SUSPECTS,
  isKnownSuspect,
} from "@/server/game/catalogue";
import { normalizeAnswer } from "@/server/game/rules";
import { GAME_CONSTANTS } from "@/server/game/constants";

/* spec §7/§8 — Round 1 catalogue integrity */
describe("Round 1 catalogue", () => {
  it("contains exactly 7 sequential puzzles P1→P7", () => {
    expect(ROUND1_PUZZLES).toHaveLength(GAME_CONSTANTS.round1.puzzleCount);
    expect(ROUND1_PUZZLES.map((p) => p.code)).toEqual(["P1", "P2", "P3", "P4", "P5", "P6", "P7"]);
    expect(ROUND1_PUZZLES.map((p) => p.orderIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("awards +100 for P1–P6 and +150 for P7", () => {
    for (const puzzle of ROUND1_PUZZLES.slice(0, 6)) {
      expect(puzzle.points).toBe(GAME_CONSTANTS.round1.pointsPerPuzzle);
    }
    expect(ROUND1_PUZZLES[6]!.points).toBe(GAME_CONSTANTS.round1.finalPuzzlePoints);
  });

  it("every puzzle ships a non-empty normalized answer and at least one hint", () => {
    for (const puzzle of ROUND1_PUZZLES) {
      expect(normalizeAnswer(puzzle.answer).length).toBeGreaterThan(0);
      expect(puzzle.hints.length).toBeGreaterThan(0);
      for (const hint of puzzle.hints) expect(hint.length).toBeGreaterThan(0);
    }
  });
});

/* spec §15/§16 — Round 2 chain integrity */
describe("Round 2 catalogue", () => {
  it("contains the supplied questions in play order", () => {
    expect(ROUND2_PUZZLES.map((p) => p.code)).toEqual([
      "S1",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
      FINAL_CODE_PUZZLE_CODE,
    ]);
  });

  it("keeps order_index contiguous, which the unlock chain depends on", () => {
    // engine.ts unlocks exactly `orderIndex + 1`, so a gap does not merely skip
    // a puzzle: it strands every later one and the culprit vote never unseals.
    expect(ROUND2_PUZZLES.map((p) => p.orderIndex)).toEqual(
      ROUND2_PUZZLES.map((_, index) => index + 1),
    );
  });

  it("retires the invented envelope and water-data chain", () => {
    expect(ROUND2_PUZZLES.some((p) => p.code.startsWith("ENV"))).toBe(false);
    expect(ROUND2_PUZZLES.some((p) => /water/i.test(p.title))).toBe(false);
    expect(ROUND2_PUZZLES.some((p) => p.kind === "PHYSICAL_CHECKPOINT")).toBe(false);
    // Every supplied question scores; nothing is a zero-point checkpoint.
    for (const puzzle of ROUND2_PUZZLES) expect(puzzle.points).toBeGreaterThan(0);
  });

  it("closes with the final code, which is the 150-point capstone", () => {
    const last = ROUND2_PUZZLES[ROUND2_PUZZLES.length - 1]!;
    expect(last.code).toBe(FINAL_CODE_PUZZLE_CODE);
    expect(last.kind).toBe("FINAL_CODE");
    expect(last.points).toBe(150);
    expect(normalizeAnswer(last.answer)).toHaveLength(5);
  });

  it("matches the answer shapes pinned by the supplied documents", () => {
    const byCode = new Map(ROUND2_PUZZLES.map((p) => [p.code, p]));
    expect(normalizeAnswer(byCode.get("S1")!.answer)).toMatch(/^[A-Z]{6}$/);
    // The two HHMM clock answers.
    for (const code of ["S3", "S8"]) {
      expect(normalizeAnswer(byCode.get(code)!.answer)).toMatch(/^\d{4}$/);
    }
    // The three newspaper-derived words are long; teams type them exactly.
    for (const code of ["S4", "S5", "S6"]) {
      expect(normalizeAnswer(byCode.get(code)!.answer)).toMatch(/^[A-Z]{8,}$/);
    }
  });

  it("gives every puzzle a non-empty briefing and answer", () => {
    for (const puzzle of ROUND2_PUZZLES) {
      expect(puzzle.briefing.trim().length).toBeGreaterThan(0);
      expect(normalizeAnswer(puzzle.answer).length).toBeGreaterThan(0);
      for (const hint of puzzle.hints) expect(hint.trim().length).toBeGreaterThan(0);
    }
  });
});

/* spec §18 — suspect roster & vote validation */
describe("suspect roster", () => {
  it("contains the correct culprit among selectable suspects", () => {
    expect(SUSPECTS.length).toBeGreaterThanOrEqual(2);
    expect(SUSPECTS.some((s) => s.code === CORRECT_SUSPECT_CODE)).toBe(true);
  });

  it("validates suspect codes strictly without leaking the answer", () => {
    for (const suspect of SUSPECTS) {
      expect(isKnownSuspect(suspect.code)).toBe(true);
    }
    expect(isKnownSuspect("NOBODY")).toBe(false);
    expect(isKnownSuspect("")).toBe(false);
    expect(isKnownSuspect("vikram_shetty")).toBe(false); // codes are exact
  });

  it("suspect codes are unique", () => {
    const codes = SUSPECTS.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
