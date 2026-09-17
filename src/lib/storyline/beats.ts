import type { RoundSnapshot } from "@/types/game";
import { getNarrativeEntry, type NarrativeEntry } from "@/lib/storyline/narrative";

/**
 * Storyline derivation — pure, no storage, no React.
 *
 * The case file is *derived* from state the server already returns, enriched
 * with investigation narrative that advances the story. Each solved puzzle
 * reveals new case information — what the discovery taught the investigators —
 * rather than restating what puzzle was just solved.
 *
 * Locked puzzles contribute no beat at all, so the file cannot spoil a round
 * the team has not reached; `PuzzleSnapshot.briefing` is null while locked even
 * before this rule is applied.
 */

export type StorylineBeatKind =
  | "ROUND_OPENED"
  | "BRIEFING_RECEIVED"
  | "LINK_BROKEN"
  | "CASE_NOTE"
  | "ROUND_ENDED";

export interface StorylineBeat {
  /**
   * Stable across renders and refreshes, so read-state and React keys never
   * re-trigger a notification for content the team has already seen.
   */
  id: string;
  kind: StorylineBeatKind;
  /** Round/puzzle code this beat belongs to. */
  code: string | null;
  title: string;
  detail: string | null;
  /** ISO instant when one exists; briefings carry no timestamp. */
  at: string | null;
  /** Investigation status tag, when present. */
  status?: NarrativeEntry["status"];
}

export interface Storyline {
  beats: StorylineBeat[];
  /**
   * Length of the file, used as the reading cursor. Beats are only ever
   * appended as the chain advances — the list is derived from `orderIndex`,
   * solve stamps and round status, never reordered — so a count is a monotonic
   * position that works for content with no timestamp (a briefing) as well as
   * content with one (a solved link). Comparing instants instead would make
   * every new briefing look permanently stale.
   */
  size: number;
}

/**
 * Builds the chronological case file for one round.
 *
 * Order is chronological by construction: the round opens, then each link in
 * chain order carries its briefing and (if broken) its narrative entry, then the
 * round closes. Puzzles are already sorted by `orderIndex` in the snapshot.
 */
export function buildStoryline(snapshot: RoundSnapshot): Storyline {
  const beats: StorylineBeat[] = [];

  if (snapshot.round.startedAt) {
    beats.push({
      id: `${snapshot.round.code}:opened`,
      kind: "ROUND_OPENED",
      code: snapshot.round.code,
      title: "Round opened — official clock running",
      detail: null,
      at: snapshot.round.startedAt,
    });
  }

  for (const puzzle of snapshot.puzzles) {
    if (puzzle.status === "LOCKED") continue;

    // The briefing itself is the discovery. It is only ever present once the
    // link unseals, so surfacing it here reveals nothing early.
    // For newspaper group puzzles, use the group prompt instead of individual briefings.
    const groupPrompt = puzzle.newspaperGroup?.prompt;
    beats.push({
      id: `${puzzle.code}:briefing`,
      kind: "BRIEFING_RECEIVED",
      code: puzzle.code,
      title: puzzle.newspaperGroup
        ? `Directive received — Newspaper Evidence`
        : `Directive received — ${puzzle.code}`,
      detail: groupPrompt ?? puzzle.briefing,
      at: null,
    });

    if (puzzle.status === "SOLVED") {
      // Look up the investigation narrative for this puzzle.
      const narrative = getNarrativeEntry(
        puzzle.code,
        snapshot.round.code,
      );

      if (narrative) {
        // Rich narrative entry: what this discovery means for the case.
        beats.push({
          id: `${puzzle.code}:solved`,
          kind: "CASE_NOTE",
          code: puzzle.code,
          title: narrative.title,
          detail: narrative.detail,
          at: puzzle.solvedAt,
          status: narrative.status,
        });
      } else {
        // Fallback: generic solve beat for puzzles without narrative content.
        const notes: string[] = [];
        if (puzzle.penaltyPoints > 0) {
          notes.push(`Penalties absorbed: −${puzzle.penaltyPoints}.`);
        }
        if (puzzle.usedHints.length > 0) {
          notes.push(`Hints drawn: ${puzzle.usedHints.length}.`);
        }
        beats.push({
          id: `${puzzle.code}:solved`,
          kind: "LINK_BROKEN",
          code: puzzle.code,
          title: `Link broken — ${puzzle.code} // ${puzzle.title}`,
          detail: notes.length > 0 ? notes.join(" ") : null,
          at: puzzle.solvedAt,
        });
      }
    }
  }

  if (snapshot.round.status === "ENDED" && snapshot.round.endsAt) {
    beats.push({
      id: `${snapshot.round.code}:ended`,
      kind: "ROUND_ENDED",
      code: snapshot.round.code,
      title: "Round closed — submissions sealed",
      detail: null,
      at: snapshot.round.endsAt,
    });
  }

  return { beats, size: beats.length };
}

/**
 * Beats the team has not read yet, given the stored cursor.
 *
 * A cursor past the end (the operator restarted, so the chain shrank) yields no
 * unread beats rather than a phantom notification; a missing cursor means the
 * file has never been opened, which is only worth flagging once progress exists.
 */
export function selectUnreadBeats(
  storyline: Storyline,
  seen: number | null,
): StorylineBeat[] {
  if (seen === null || !Number.isFinite(seen) || seen < 0) {
    return seen === null ? storyline.beats.slice(firstProgressIndex(storyline)) : [];
  }
  if (seen >= storyline.size) return [];
  return storyline.beats.slice(seen);
}

/**
 * Where a brand-new reader's cursor starts. The opening directive is what they
 * are handed before they act, so it is not "new information" that deserves a
 * badge; anything the team's own solving produced is.
 */
export function firstProgressIndex(storyline: Storyline): number {
  const index = storyline.beats.findIndex(
    (beat) => beat.kind === "BRIEFING_RECEIVED" || beat.kind === "LINK_BROKEN",
  );
  return index === -1 ? storyline.size : index;
}
