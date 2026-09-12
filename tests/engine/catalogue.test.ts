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
  it("follows the supplied progression exactly", () => {
    expect(ROUND2_PUZZLES.map((p) => p.code)).toEqual([
      "S1",
      "ENV_A",
      "S2",
      "ENV_B",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
      FINAL_CODE_PUZZLE_CODE,
    ]);
    expect(ROUND2_PUZZLES.map((p) => p.orderIndex)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
  });

  it("models both envelopes as zero-point physical checkpoints", () => {
    for (const code of ["ENV_A", "ENV_B"]) {
      const checkpoint = ROUND2_PUZZLES.find((p) => p.code === code);
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.kind).toBe("PHYSICAL_CHECKPOINT");
      expect(checkpoint!.points).toBe(0);
    }
  });

  it("marks the final code puzzle accordingly", () => {
    const final = ROUND2_PUZZLES.find((p) => p.code === FINAL_CODE_PUZZLE_CODE);
    expect(final!.kind).toBe("FINAL_CODE");
    expect(final!.points).toBe(150);
  });

  it("round 2 letters and envelopes stay consistent with supplied anchors", () => {
    // S1 spells its six-letter word from first letters of the draft.
    expect(normalizeAnswer(ROUND2_PUZZLES[0]!.answer)).toHaveLength(6);
    // Envelope checkpoints are code-like (4 digits) references.
    for (const code of ["ENV_A", "ENV_B"]) {
      const checkpoint = ROUND2_PUZZLES.find((p) => p.code === code)!;
      expect(normalizeAnswer(checkpoint.answer)).toMatch(/^\d{4}$/);
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
