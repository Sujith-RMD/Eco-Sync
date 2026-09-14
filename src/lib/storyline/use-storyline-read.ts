"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getStorylineCursor,
  SERVER_READ_STATE,
  setStorylineCursor,
  storylineStorageKey,
  unseenCount,
} from "@/lib/storyline/read-state";
import {
  emitStorylineSignal,
  subscribeToStorylineSignal,
} from "@/lib/storyline/signal";
import type { StorylineSummary } from "@/lib/storyline/summary";

export interface StorylineReadState {
  /** False while the store still answers with the server snapshot. */
  hydrated: boolean;
  seen: number;
  unseen: number;
  hasUnread: boolean;
  markRead: () => void;
}

/**
 * One reading position, shared by the tab badge and the case file itself.
 *
 * `useSyncExternalStore` rather than state-in-an-effect: the cursor lives in
 * `localStorage`, which means the server render cannot see it. The hook renders
 * the safe snapshot first (no badge, so no hydration mismatch) and settles on
 * the device's real position immediately after, which is also what lets a
 * second tab of the same team stay in step.
 */
export function useStorylineRead(summary: StorylineSummary): StorylineReadState {
  const { roundCode, teamName, size, firstProgressIndex, startedAt } = summary;
  const key = storylineStorageKey(roundCode, teamName);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const offSignal = subscribeToStorylineSignal("read", (detail) => {
        if (!detail.roundCode || detail.roundCode === roundCode) onChange();
      });
      const onStorage = (event: StorageEvent) => {
        // A null key means storage was cleared wholesale: re-read everything.
        if (event.key === null || event.key === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        offSignal();
        window.removeEventListener("storage", onStorage);
      };
    },
    [key, roundCode],
  );

  const getSnapshot = useCallback(
    () => getStorylineCursor(roundCode, teamName, startedAt),
    [roundCode, teamName, startedAt],
  );

  const state = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_READ_STATE,
  );

  const markRead = useCallback(() => {
    setStorylineCursor(roundCode, teamName, size, startedAt);
    emitStorylineSignal("read", { roundCode });
  }, [roundCode, teamName, size, startedAt]);

  const unseen = unseenCount(size, firstProgressIndex, state.seen);

  return {
    hydrated: state !== SERVER_READ_STATE,
    seen: state.seen,
    unseen,
    hasUnread: unseen > 0,
    markRead,
  };
}
