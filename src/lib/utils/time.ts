/**
 * Event-local time formatting.
 *
 * Storage and transport stay UTC everywhere — `timestamptz` columns in
 * PostgreSQL and ISO-8601 strings in every DTO and API response. That is the
 * correct representation for an instant, and it must not change.
 *
 * Only the *display* layer is event-local. The event runs on Indian Standard
 * Time, so every human-facing stamp renders in `Asia/Kolkata`. The zone is
 * passed explicitly rather than inherited from the host, for two reasons:
 *
 *   1. A deployment box (or a Vercel region) in UTC would otherwise quietly
 *      shift every clock on the command deck.
 *   2. Server-rendered markup must match the client re-render, or React
 *      hydration throws a mismatch warning — which it would if the server used
 *      the host zone and the browser used the visitor's.
 */

export const EVENT_TIME_ZONE = "Asia/Kolkata";
export const EVENT_TIME_ZONE_LABEL = "IST";

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: EVENT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toInstant(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const EMPTY = "—";

/** `19:16:22` — event-local wall clock, 24-hour. */
export function toEventClock(value: Date | string | null | undefined): string {
  const date = toInstant(value);
  return date ? clockFormatter.format(date) : EMPTY;
}

/** `2026-09-12` — event-local calendar day (may differ from the UTC day). */
export function toEventDay(value: Date | string | null | undefined): string {
  const date = toInstant(value);
  return date ? dayFormatter.format(date) : EMPTY;
}

/** `2026-09-12 19:16:22` — full event-local stamp, for ledgers and audits. */
export function toEventStamp(value: Date | string | null | undefined): string {
  const date = toInstant(value);
  return date ? `${toEventDay(date)} ${toEventClock(date)}` : EMPTY;
}

/** Event-local stamp with an explicit zone marker: `… 19:16:22 IST`. */
export function toEventStampZoned(
  value: Date | string | null | undefined,
): string {
  const stamp = toEventStamp(value);
  return stamp === EMPTY ? stamp : `${stamp} ${EVENT_TIME_ZONE_LABEL}`;
}
