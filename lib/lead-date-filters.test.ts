import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DATE_PRESETS, isDatePreset, resolveDateRange } from "@/lib/lead-date-filters";

describe("isDatePreset", () => {
  it("recognises only the real preset ids", () => {
    DATE_PRESETS.forEach(({ id }) => expect(isDatePreset(id)).toBe(true));
    expect(isDatePreset("not-a-real-preset")).toBe(false);
    expect(isDatePreset("")).toBe(false);
  });
});

describe("resolveDateRange", () => {
  it("returns null when no preset is set", () => {
    expect(resolveDateRange({})).toBeNull();
    expect(resolveDateRange({ datePreset: "" })).toBeNull();
    expect(resolveDateRange({ datePreset: "bogus" })).toBeNull();
  });

  describe("resolved against a fixed IST 'now'", () => {
    beforeEach(() => {
      // 2026-09-27T10:00Z = 15:30 IST on the 27th.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("today", () => {
      expect(resolveDateRange({ datePreset: "today" })).toEqual({ from: "2026-09-27", to: "2026-09-27" });
    });

    it("yesterday", () => {
      expect(resolveDateRange({ datePreset: "yesterday" })).toEqual({ from: "2026-09-26", to: "2026-09-26" });
    });

    it("last7 -- inclusive of today, 7 days total", () => {
      expect(resolveDateRange({ datePreset: "last7" })).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    });

    it("last30 -- inclusive of today, 30 days total", () => {
      expect(resolveDateRange({ datePreset: "last30" })).toEqual({ from: "2026-08-29", to: "2026-09-27" });
    });

    it("thisMonth", () => {
      expect(resolveDateRange({ datePreset: "thisMonth" })).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    });

    it("lastMonth -- rolls back a full calendar month", () => {
      expect(resolveDateRange({ datePreset: "lastMonth" })).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    });
  });

  describe("custom range", () => {
    it("uses the given from/to as-is when already in order", () => {
      expect(resolveDateRange({ datePreset: "custom", dateFrom: "2026-09-01", dateTo: "2026-09-10" })).toEqual({
        from: "2026-09-01",
        to: "2026-09-10",
      });
    });

    it("swaps an inverted from/to instead of returning an empty range", () => {
      expect(resolveDateRange({ datePreset: "custom", dateFrom: "2026-09-10", dateTo: "2026-09-01" })).toEqual({
        from: "2026-09-01",
        to: "2026-09-10",
      });
    });

    it("returns null when from or to is missing or malformed", () => {
      expect(resolveDateRange({ datePreset: "custom" })).toBeNull();
      expect(resolveDateRange({ datePreset: "custom", dateFrom: "2026-09-01" })).toBeNull();
      expect(resolveDateRange({ datePreset: "custom", dateFrom: "not-a-date", dateTo: "2026-09-10" })).toBeNull();
    });
  });

  it("rolls a month boundary back correctly in January", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-15T10:00:00Z"));
    expect(resolveDateRange({ datePreset: "lastMonth" })).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    vi.useRealTimers();
  });
});
