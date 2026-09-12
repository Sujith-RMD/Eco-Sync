import { describe, expect, it } from "vitest";
import {
  EVENT_TIME_ZONE,
  toEventClock,
  toEventDay,
  toEventStamp,
  toEventStampZoned,
} from "@/lib/utils/time";

/**
 * Display-layer formatting only. The instants below are the real UTC values a
 * `timestamptz` column returns; Asia/Kolkata is UTC+05:30 with no DST.
 */
describe("event-local time formatting (IST)", () => {
  it("renders a UTC instant on the event clock (+05:30)", () => {
    expect(EVENT_TIME_ZONE).toBe("Asia/Kolkata");
    expect(toEventClock("2026-09-12T13:46:22.991Z")).toBe("19:16:22");
    expect(toEventClock(new Date("2026-09-12T13:46:22.991Z"))).toBe("19:16:22");
  });

  it("keeps a half-hour offset exact", () => {
    expect(toEventClock("2026-09-12T00:00:00Z")).toBe("05:30:00");
  });

  it("rolls the calendar day when UTC is behind IST", () => {
    // 19:00 UTC on the 12th is already 00:30 on the 13th in IST. Reading the
    // UTC string (the old toISOString().slice(0, 10) behaviour) said "12".
    const instant = "2026-09-12T19:00:00Z";
    expect(toEventDay(instant)).toBe("2026-09-13");
    expect(toEventStamp(instant)).toBe("2026-09-13 00:30:00");
  });

  it("pads single-digit hours to a 24-hour clock", () => {
    expect(toEventClock("2026-09-12T18:59:59Z")).toBe("00:29:59");
  });

  it("labels the zone when asked", () => {
    expect(toEventStampZoned("2026-09-12T13:46:22.991Z")).toBe(
      "2026-09-12 19:16:22 IST",
    );
  });

  it("renders empty for missing or unparseable input", () => {
    expect(toEventClock(null)).toBe("—");
    expect(toEventClock(undefined)).toBe("—");
    expect(toEventClock("not-a-date")).toBe("—");
    expect(toEventDay(null)).toBe("—");
    expect(toEventStampZoned(null)).toBe("—");
  });
});
