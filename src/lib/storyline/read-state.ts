"use client";

/**
 * Storyline reading position, per unit and per round.
 *
 * The database is the source of truth for *progress* — `team_puzzle_progress`
 * already knows which links are broken and when, and the case file is derived
 * from it. What the database deliberately does not know is whether a given
 * handset has *looked at* the file yet, because that is a property of a device,
 * not of the team: two phones in one unit read at their own pace. So progress
 * arrives from the server with every snapshot, and only this reading position
 * is kept locally — the same contract a messaging client's "read" marker has.
 *
 * Nothing here can grant or hide content, and no answer, score or briefing is
 * stored. Losing the entry is harmless: the worst case is that a unit sees the
 * "new information" marker once more.
 */

const PREFIX = "ecosync:storyline-read-v1";

export interface StoredReadState {
  /** Beats already viewed. */
  seen: number;
  /**
   * The round opening this cursor belongs to. RESTART clears solve stamps, so a
   * cursor carried across a restart would swallow the next real unlock; when
   * the opening instant differs, the cursor is discarded.
   */
  startedAt: string | null;
}

/**
 * Position used when no cursor is reachable — server render, private mode, or
 * storage disabled. Nothing can be recorded as read in those cases, so treating
 * the file as fully read is the only answer that does not leave a badge lit
 * forever; the unlock notice still fires, because that is event-driven.
 */
const UNTRACKED = Number.MAX_SAFE_INTEGER;

export const SERVER_READ_STATE: StoredReadState = Object.freeze({
  seen: UNTRACKED,
  startedAt: null,
});

export function storylineStorageKey(roundCode: string, teamName: string): string {
  return `${PREFIX}:${roundCode}:${teamName}`;
}

function canStore(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

function load(
  key: string,
  startedAt: string | null,
): StoredReadState {
  if (!canStore()) return { seen: UNTRACKED, startedAt };
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { seen: 0, startedAt };
    const parsed = JSON.parse(raw) as Partial<StoredReadState>;
    if (typeof parsed.seen !== "number" || !Number.isFinite(parsed.seen)) {
      return { seen: 0, startedAt };
    }
    const seen = Math.max(0, Math.floor(parsed.seen));
    // A different round opening (or none, after a restart) invalidates the cursor.
    if ((parsed.startedAt ?? null) !== startedAt) return { seen: 0, startedAt };
    return { seen, startedAt };
  } catch {
    // Malformed JSON, a payload from another build, or a blocked read.
    return { seen: 0, startedAt };
  }
}

/**
 * Snapshot reader for `useSyncExternalStore`.
 *
 * Results are cached per key because the hook compares snapshots by identity:
 * returning a fresh object on every call would make React re-render endlessly.
 */
const cache = new Map<string, StoredReadState>();

export function getStorylineCursor(
  roundCode: string,
  teamName: string,
  startedAt: string | null,
): StoredReadState {
  const key = storylineStorageKey(roundCode, teamName);
  const cached = cache.get(key);
  if (cached && cached.startedAt === startedAt) return cached;
  const next = load(key, startedAt);
  cache.set(key, next);
  return next;
}

export function setStorylineCursor(
  roundCode: string,
  teamName: string,
  size: number,
  startedAt: string | null,
): void {
  const key = storylineStorageKey(roundCode, teamName);
  const next: StoredReadState = { seen: Math.max(0, size), startedAt };
  cache.set(key, next);
  if (!canStore()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // A failed write only means the marker can reappear; it must never break play.
  }
}

/**
 * How many beats deserve a "new information" flag.
 *
 * `floor` is the index of the first beat the unit's own investigation produced:
 * the round-opening directive is handed over before anyone acts, so flagging it
 * as a discovery would put a badge on the tab before there is anything to read.
 */
export function unseenCount(size: number, floor: number, seen: number): number {
  return Math.max(0, size - Math.max(seen, floor));
}
