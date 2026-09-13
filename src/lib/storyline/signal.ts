"use client";

/**
 * Two signals that cross the component tree without being threaded through
 * props, because their endpoints are deliberately far apart:
 *
 *   unlocked — the answer form just accepted a correct answer (deep inside the
 *              console) and the storyline toast needs to appear.
 *   read     — the case file was opened and marked as seen (a page body) and
 *              the tab badge in the navigation needs to clear.
 *
 * A module-level emitter fits here rather than context or a store: there is no
 * data to share, only a moment to announce, and both endpoints already own their
 * own state. Subscribers must unsubscribe (see `useStorylineSignal`).
 *
 * Callbacks are stored on `globalThis` so Next's development hot-reload does not
 * orphan listeners from a previous module instance — a duplicated emitter would
 * double-fire the toast, which is exactly the duplicate notification this design
 * is meant to avoid.
 */

export type StorylineSignal = "unlocked" | "read";

type Listener = (detail: StorylineSignalDetail) => void;

export interface StorylineSignalDetail {
  roundCode: string;
  /** Beat ids this signal concerns, when the sender knows them. */
  beatIds?: string[];
}

interface Bus {
  listeners: Map<StorylineSignal, Set<Listener>>;
}

const globalBus = globalThis as typeof globalThis & {
  __ecosyncStorylineBus?: Bus;
};

function bus(): Bus {
  globalBus.__ecosyncStorylineBus ??= { listeners: new Map() };
  return globalBus.__ecosyncStorylineBus;
}

export function emitStorylineSignal(
  signal: StorylineSignal,
  detail: StorylineSignalDetail,
): void {
  const handlers = bus().listeners.get(signal);
  if (!handlers) return;
  for (const listener of [...handlers]) {
    try {
      listener(detail);
    } catch {
      // A broken listener must not break the submission that announced it.
    }
  }
}

export function subscribeToStorylineSignal(
  signal: StorylineSignal,
  listener: Listener,
): () => void {
  const { listeners } = bus();
  const set = listeners.get(signal) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(signal, set);
  return () => {
    set.delete(listener);
  };
}
