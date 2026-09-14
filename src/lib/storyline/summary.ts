import {
  buildStoryline,
  firstProgressIndex,
  type Storyline,
} from "@/lib/storyline/beats";
import type { RoundCode, RoundSnapshot, TeamSnapshotResult } from "@/types/game";

/**
 * The minimum the navigation needs to light its badge: how long the case file
 * is, where the team's own discoveries begin, and which round opening the
 * reading position belongs to. Passing this instead of the full beat list keeps
 * every payload a page already computes.
 */
export interface StorylineSummary {
  roundCode: RoundCode;
  teamName: string;
  size: number;
  firstProgressIndex: number;
  startedAt: string | null;
}

export interface StorylineBundle {
  summary: StorylineSummary;
  /** Null when the round has not opened for this team yet. */
  storyline: Storyline | null;
}

function summaryOf(
  roundCode: RoundCode,
  teamName: string,
  storyline: Storyline | null,
  startedAt: string | null,
): StorylineSummary {
  return {
    roundCode,
    teamName,
    size: storyline?.size ?? 0,
    firstProgressIndex: storyline ? firstProgressIndex(storyline) : 0,
    startedAt,
  };
}

/** Case file for a live or completed round the team can see. */
export function buildStorylineBundle(
  snapshot: RoundSnapshot,
  roundCode: RoundCode,
  teamName: string,
): StorylineBundle {
  const storyline = buildStoryline(snapshot);
  return {
    storyline,
    summary: summaryOf(roundCode, teamName, storyline, snapshot.round.startedAt),
  };
}

/**
 * Case file for every non-ready state (standby, gated, unseeded). The badge
 * stays dark because there is nothing the team's own work has produced; the
 * page still renders, so the tab never disappears mid-round.
 */
export function buildPendingStorylineBundle(
  result: TeamSnapshotResult,
  roundCode: RoundCode,
  teamName: string,
): StorylineBundle {
  const openedAt =
    result.kind === "ready"
      ? result.snapshot.round.startedAt
      : result.kind === "uninitialized"
        ? null
        : result.round.startedAt;
  return {
    storyline: null,
    summary: summaryOf(roundCode, teamName, null, openedAt),
  };
}
