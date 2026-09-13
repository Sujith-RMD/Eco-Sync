import "server-only";
import { requireTeam } from "@/lib/auth/guards";
import { getTeamRoundSnapshot } from "@/server/game/engine";
import {
  buildPendingStorylineBundle,
  buildStorylineBundle,
  type StorylineBundle,
} from "@/lib/storyline/summary";
import type { RoundCode, RoundStatus, TeamSnapshotResult } from "@/types/game";

export interface RoundProgress {
  solved: number;
  total: number;
  currentCode: string | null;
}

export interface TeamRoundContext {
  teamName: string;
  result: TeamSnapshotResult;
  bundle: StorylineBundle;
  /** Null until the round is actually visible to this unit. */
  progress: RoundProgress | null;
}

/**
 * Everything the three participant tabs need, resolved once per request.
 *
 * Storyline, Answers and Suspects are three routes over the same state, so they
 * share one loader instead of each re-implementing the auth check, the snapshot
 * call and the case-file derivation. The snapshot is fetched per request because
 * `force-dynamic` pages must never serve a stale chain — and because
 * `getTeamRoundSnapshot` is what bootstraps participation in the first place.
 */
export async function loadTeamRoundContext(
  round: RoundCode,
): Promise<TeamRoundContext> {
  const { team } = await requireTeam();
  const result = await getTeamRoundSnapshot(team.id, team.name, round);

  if (result.kind === "ready") {
    const snapshot = result.snapshot;
    return {
      teamName: team.name,
      result,
      bundle: buildStorylineBundle(snapshot, round, team.name),
      progress: {
        solved: snapshot.solvedCount,
        total: snapshot.totalCount,
        currentCode: snapshot.currentPuzzleCode,
      },
    };
  }

  return {
    teamName: team.name,
    result,
    bundle: buildPendingStorylineBundle(result, round, team.name),
    progress: null,
  };
}

/** Round status without unpacking the discriminated result at every call site. */
export function roundStatusOf(result: TeamSnapshotResult): RoundStatus {
  if (result.kind === "ready") return result.snapshot.round.status;
  if (result.kind === "uninitialized") return "PENDING";
  return result.round.status;
}

/** When the round opened, for the case file's own framing. */
export function roundOpenedAt(result: TeamSnapshotResult): string | null {
  if (result.kind === "ready") return result.snapshot.round.startedAt;
  if (result.kind === "uninitialized") return null;
  return result.round.startedAt;
}
