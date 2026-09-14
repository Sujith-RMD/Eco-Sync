import { describe, expect, it } from "vitest";
import {
  describeUnarmed,
  isUnarmedAnswer,
  UNARMED_SENTINEL,
} from "@/server/game/unarmed";
import {
  ROUND1_PUZZLES,
  ROUND2_PUZZLES,
} from "@/server/game/catalogue";

/**
 * The rule that decides whether 60 rooms can play a round.
 *
 * A placeholder answer is not a cosmetic gap: the chain unseals `orderIndex + 1`
 * by exact match, so one un-armed link strands everything behind it, including
 * the final code and the culprit vote. The guard therefore treats *any*
 * `__LIKE_THIS__` value as un-armed, not only the current marker — and an empty
 * answer too, since it is equally unpassable from the UI.
 */

const unarmedIn = (rows: typeof ROUND1_PUZZLES) =>
  rows.filter((p) => isUnarmedAnswer(p.answer)).map((p) => p.code);

describe("isUnarmedAnswer", () => {
  it("recognises the current marker in any casing or padding", () => {
    expect(isUnarmedAnswer(UNARMED_SENTINEL)).toBe(true);
    expect(isUnarmedAnswer("  __unarmed__  ")).toBe(true);
  });

  it("recognises a placeholder it has never seen before", () => {
    expect(isUnarmedAnswer("__TODO_QR_PAYLOAD__")).toBe(true);
    expect(isUnarmedAnswer("__PLACEHOLDER_2__")).toBe(true);
  });

  it("leaves real answers alone, including ones that merely contain underscores", () => {
    for (const answer of ["UNARMED_SENTINEL", "FUDGED", "0215", "TRUTH", "A_B"]) {
      expect(isUnarmedAnswer(answer)).toBe(false);
    }
    expect(isUnarmedAnswer("__UNARMED")).toBe(false);
    expect(isUnarmedAnswer("UNARMED__")).toBe(false);
  });

  it("treats an empty answer as un-armed, because nobody could ever type it", () => {
    // This assertion used to read `toBe(false)`, which left the guard blind to
    // the one input it could not otherwise catch. An empty expected answer is
    // not a free solve: the submit action rejects `answer.length === 0`, so the
    // link is unpassable and everything behind it is stranded — precisely the
    // failure the guard exists to prevent.
    expect(isUnarmedAnswer("")).toBe(true);
    expect(isUnarmedAnswer("   ")).toBe(true);
    expect(isUnarmedAnswer("\n\t ")).toBe(true);
  });
});

describe("describeUnarmed", () => {
  it("names each link with its position, singular or plural", () => {
    const one = describeUnarmed([{ code: "S7", orderIndex: 6 }], 8, "Round 02");
    expect(one).toContain("1 link still has a placeholder answer");
    expect(one).toContain("S7 (position 6 of 8)");

    const many = describeUnarmed(
      [
        { code: "S4", orderIndex: 3 },
        { code: "S7", orderIndex: 6 },
      ],
      8,
      "Round 02",
    );
    expect(many).toContain("2 links still have a placeholder answer");
    expect(many).toContain("S4 (position 3 of 8)");
    expect(many).toContain("S7 (position 6 of 8)");
  });

  it("states the blast radius, because position is the whole problem", () => {
    const midChain = describeUnarmed([{ code: "S7", orderIndex: 6 }], 8, "Round 02");
    expect(midChain).toContain("Every link behind it (2 of 8)");
    expect(midChain).toContain("final code");

    const lastOnly = describeUnarmed([{ code: "LAST", orderIndex: 8 }], 8, "Round 02");
    expect(lastOnly).toContain("could never be completed");
    expect(lastOnly).not.toContain("Every link behind it");
  });

  it("tells the operator what to do next", () => {
    const message = describeUnarmed([{ code: "S7", orderIndex: 6 }], 8, "Round 02");
    expect(message).toContain("Arm those answers in the database");
  });
});

describe("catalogue armed state", () => {
  it("Round 01 is fully armed — no link may resemble a placeholder", () => {
    expect(unarmedIn(ROUND1_PUZZLES)).toEqual([]);
  });

  it("Round 02 is fully armed — the QR pair no longer reads as a placeholder", () => {
    // This assertion USED to be a deliberate tripwire reading ["S7"], so that
    // arming the QR pair could not be done in the database alone. It is now
    // armed in every place at once — the live row, db/round-2-content.sql,
    // db/verify-round-2.sql and this catalogue — and the tripwire flipped with
    // it: a placeholder reappearing anywhere in Round 02 lights this up again,
    // which is exactly when a round must not be opened.
    expect(unarmedIn(ROUND2_PUZZLES)).toEqual([]);
  });

  it("the marker is unmistakable as an answer, so nobody can type it by accident", () => {
    expect(UNARMED_SENTINEL.length).toBeGreaterThanOrEqual(8);
    expect(UNARMED_SENTINEL).toBe(UNARMED_SENTINEL.toUpperCase());
    expect(isUnarmedAnswer(UNARMED_SENTINEL)).toBe(true);
  });
});
