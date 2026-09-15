import { describe, expect, it } from "vitest";
import {
  buildStoryline,
  firstProgressIndex,
  selectUnreadBeats,
  type StorylineBeat,
} from "@/lib/storyline/beats";
import { unseenCount } from "@/lib/storyline/read-state";
import {
  buildPendingStorylineBundle,
  buildStorylineBundle,
} from "@/lib/storyline/summary";
import type {
  PuzzleSnapshot,
  RoundSnapshot,
  TeamSnapshotResult,
} from "@/types/game";

/**
 * The case file is derived, so these tests are the contract that keeps it
 * honest: nothing locked may appear, nothing unsaid may appear, and a refresh
 * must never look like new information.
 */

function puzzle(overrides: Partial<PuzzleSnapshot> & { code: string }): PuzzleSnapshot {
  return {
    orderIndex: 1,
    kind: "DIGITAL",
    title: `Title ${overrides.code}`,
    briefing: null,
    points: 100,
    status: "LOCKED",
    isCurrent: false,
    wrongAttempts: 0,
    penaltyPoints: 0,
    lockedUntil: null,
    solvedAt: null,
    hintsAvailable: 0,
    usedHints: [],
    // Null unless the link is SOLVED — the reveal URL carries the answer.
    reveal: null,
    answerInput: { placeholder: "ENTER ANSWER", maxLength: 255, lettersOnly: false },
    ...overrides,
  };
}

function snapshot(overrides: Partial<RoundSnapshot> = {}): RoundSnapshot {
  return {
    teamName: "ALPHA",
    round: {
      code: "ROUND_1",
      status: "ACTIVE",
      startedAt: "2026-02-14T09:00:00.000Z",
      endsAt: "2026-02-14T09:40:00.000Z",
      durationMinutes: 40,
      serverTime: "2026-02-14T09:10:00.000Z",
      remainingSeconds: 1800,
    },
    score: 0,
    solvedCount: 0,
    totalCount: 0,
    puzzles: [],
    currentPuzzleCode: null,
    finished: false,
    finishedAt: null,
    finalRank: null,
    qualified: null,
    ...overrides,
  };
}

const kinds = (beats: StorylineBeat[]) => beats.map((beat) => beat.kind);

describe("buildStoryline", () => {
  it("says nothing about links that are still sealed", () => {
    const storyline = buildStoryline(
      snapshot({
        totalCount: 3,
        puzzles: [
          puzzle({ code: "S1", status: "LOCKED" }),
          puzzle({ code: "S3", status: "LOCKED" }),
          puzzle({ code: "LAST", status: "LOCKED" }),
        ],
      }),
    );

    expect(kinds(storyline.beats)).toEqual(["ROUND_OPENED"]);
    // Locked briefings and titles must not be echoed, even as a preview.
    expect(JSON.stringify(storyline.beats)).not.toContain("S1");
    expect(JSON.stringify(storyline.beats)).not.toContain("LAST");
  });

  it("ignores a briefing that is null, so a sealed link can never leak a hint of content", () => {
    const storyline = buildStoryline(
      snapshot({
        puzzles: [puzzle({ code: "S1", status: "UNLOCKED", briefing: null })],
      }),
    );
    const briefing = storyline.beats.find(
      (beat) => beat.kind === "BRIEFING_RECEIVED",
    );
    expect(briefing?.detail).toBeNull();
    expect(briefing?.title).toContain("S1");
  });

  it("carries the briefing verbatim — the case file adds no narrative of its own", () => {
    const briefing =
      "Retrieve the marked page.\nThe margin holds the answer.";
    const storyline = buildStoryline(
      snapshot({
        puzzles: [
          puzzle({ code: "S1", status: "UNLOCKED", briefing, orderIndex: 1 }),
        ],
      }),
    );
    const beat = storyline.beats.find((b) => b.kind === "BRIEFING_RECEIVED");
    expect(beat?.detail).toBe(briefing);
    expect(beat?.at).toBeNull();
  });

  it("orders the file chronologically: opening, then each link's directive then its solve", () => {
    const storyline = buildStoryline(
      snapshot({
        solvedCount: 1,
        totalCount: 2,
        currentPuzzleCode: "S3",
        puzzles: [
          puzzle({
            code: "S1",
            orderIndex: 1,
            status: "SOLVED",
            briefing: "one",
            solvedAt: "2026-02-14T09:05:00.000Z",
          }),
          puzzle({
            code: "S3",
            orderIndex: 2,
            status: "UNLOCKED",
            briefing: "two",
            isCurrent: true,
          }),
        ],
      }),
    );

    expect(kinds(storyline.beats)).toEqual([
      "ROUND_OPENED",
      "BRIEFING_RECEIVED",
      "LINK_BROKEN",
      "BRIEFING_RECEIVED",
    ]);
    expect(storyline.beats.map((beat) => beat.code)).toEqual([
      "ROUND_1",
      "S1",
      "S1",
      "S3",
    ]);
    expect(storyline.size).toBe(storyline.beats.length);
  });

  it("only reports what the team actually paid for on a broken link", () => {
    const clean = buildStoryline(
      snapshot({
        puzzles: [
          puzzle({
            code: "S1",
            status: "SOLVED",
            briefing: "one",
            solvedAt: "2026-02-14T09:05:00.000Z",
          }),
        ],
      }),
    );
    expect(clean.beats.at(-1)?.detail).toBeNull();

    const costly = buildStoryline(
      snapshot({
        puzzles: [
          puzzle({
            code: "S1",
            status: "SOLVED",
            briefing: "one",
            solvedAt: "2026-02-14T09:05:00.000Z",
            penaltyPoints: 40,
            usedHints: ["H1"],
          }),
        ],
      }),
    );
    const detail = costly.beats.at(-1)?.detail ?? "";
    expect(detail).toContain("40");
    expect(detail).toContain("Hints drawn: 1");
  });

  it("closes the file only when the round is actually over", () => {
    const live = buildStoryline(snapshot({ puzzles: [] }));
    expect(kinds(live.beats)).not.toContain("ROUND_ENDED");

    const closed = buildStoryline(
      snapshot({ round: { ...snapshot().round, status: "ENDED" } }),
    );
    expect(kinds(closed.beats)).toContain("ROUND_ENDED");
    expect(closed.beats.at(-1)?.at).toBe("2026-02-14T09:40:00.000Z");

    // No endsAt means no invented timestamp.
    const vague = buildStoryline(
      snapshot({
        round: { ...snapshot().round, status: "ENDED", endsAt: null },
      }),
    );
    expect(kinds(vague.beats)).not.toContain("ROUND_ENDED");
  });

  it("does not announce an opening that has not happened", () => {
    const storyline = buildStoryline(
      snapshot({
        round: { ...snapshot().round, status: "PENDING", startedAt: null },
        puzzles: [],
      }),
    );
    expect(storyline.beats).toEqual([]);
    expect(storyline.size).toBe(0);
  });
});

describe("reading cursor", () => {
  const progressed = buildStoryline(
    snapshot({
      puzzles: [
        puzzle({
          code: "S1",
          status: "SOLVED",
          briefing: "one",
          solvedAt: "2026-02-14T09:05:00.000Z",
        }),
      ],
    }),
  );
  // [ROUND_OPENED, S1:briefing, S1:solved]
  const openedOnly = buildStoryline(snapshot({ puzzles: [] }));

  it("starts a first-time reader at their own discovery, not at the opening directive", () => {
    expect(firstProgressIndex(progressed)).toBe(1);
    expect(firstProgressIndex(openedOnly)).toBe(openedOnly.size);
  });

  it("flags a new unlock exactly once", () => {
    // Cursor 1 = only the opening directive was read, so both the unsealed
    // briefing and the solve stamp are still outstanding.
    expect(selectUnreadBeats(progressed, 1).map((b) => b.kind)).toEqual([
      "BRIEFING_RECEIVED",
      "LINK_BROKEN",
    ]);
    // Cursor 2 = the briefing was read; solving it is the only new beat.
    expect(selectUnreadBeats(progressed, 2).map((b) => b.kind)).toEqual([
      "LINK_BROKEN",
    ]);
    // Same progress re-rendered by auto-refresh → nothing to flag.
    expect(selectUnreadBeats(progressed, 3)).toEqual([]);
    // Never opened → only the team's own progress counts as unread.
    expect(selectUnreadBeats(progressed, null)).toHaveLength(2);
    expect(selectUnreadBeats(openedOnly, null)).toEqual([]);
  });

  it("survives a restart that shrank the file", () => {
    // Cursor from before the restart sits past the end of the new file.
    expect(selectUnreadBeats(openedOnly, 9)).toEqual([]);
    expect(unseenCount(openedOnly.size, firstProgressIndex(openedOnly), 9)).toBe(0);
  });

  it("counts what the badge will show", () => {
    expect(unseenCount(progressed.size, firstProgressIndex(progressed), 0)).toBe(2);
    expect(unseenCount(progressed.size, firstProgressIndex(progressed), 1)).toBe(2);
    expect(unseenCount(progressed.size, firstProgressIndex(progressed), 3)).toBe(0);
    // Never-opened file with nothing but the opening directive: no badge.
    expect(unseenCount(openedOnly.size, firstProgressIndex(openedOnly), 0)).toBe(0);
  });
});

describe("storyline bundles", () => {
  it("summarises a live round for the tab badge", () => {
    const bundle = buildStorylineBundle(
      snapshot({
        puzzles: [puzzle({ code: "S1", status: "UNLOCKED", briefing: "one" })],
      }),
      "ROUND_1",
      "ALPHA",
    );
    expect(bundle.summary).toEqual({
      roundCode: "ROUND_1",
      teamName: "ALPHA",
      size: 2,
      firstProgressIndex: 1,
      startedAt: "2026-02-14T09:00:00.000Z",
    });
    expect(bundle.storyline?.beats).toHaveLength(2);
  });

  it("produces a dark badge for standby, gated and unseeded rounds", () => {
    const round = snapshot().round;
    const cases: TeamSnapshotResult[] = [
      { kind: "uninitialized" },
      { kind: "pending", round },
      { kind: "gated", round, reason: "AWAITING_QUALIFICATION" },
    ];
    for (const result of cases) {
      const bundle = buildPendingStorylineBundle(result, "ROUND_2", "ALPHA");
      expect(bundle.storyline).toBeNull();
      expect(bundle.summary.size).toBe(0);
      expect(bundle.summary.firstProgressIndex).toBe(0);
      expect(bundle.summary.roundCode).toBe("ROUND_2");
    }
  });
});
