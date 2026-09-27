import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REPORT_DATE_PRESETS, isReportDatePreset, resolveReportDateRange } from "@/lib/report-date-filters";

describe("isReportDatePreset", () => {
  it("recognises only the real preset ids", () => {
    REPORT_DATE_PRESETS.forEach(({ id }) => expect(isReportDatePreset(id)).toBe(true));
    expect(isReportDatePreset("not-a-real-preset")).toBe(false);
  });
});

describe("resolveReportDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z")); // 15:30 IST on the 27th
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to last30 when no preset is given", () => {
    expect(resolveReportDateRange({})).toEqual({ from: "2026-08-29", to: "2026-09-27", preset: "last30" });
  });

  it("defaults to last30 for an unrecognised preset", () => {
    expect(resolveReportDateRange({ datePreset: "bogus" })).toEqual({ from: "2026-08-29", to: "2026-09-27", preset: "last30" });
  });

  it("today", () => {
    expect(resolveReportDateRange({ datePreset: "today" })).toEqual({ from: "2026-09-27", to: "2026-09-27", preset: "today" });
  });

  it("last7", () => {
    expect(resolveReportDateRange({ datePreset: "last7" })).toEqual({ from: "2026-09-21", to: "2026-09-27", preset: "last7" });
  });

  it("thisMonth", () => {
    expect(resolveReportDateRange({ datePreset: "thisMonth" })).toEqual({ from: "2026-09-01", to: "2026-09-30", preset: "thisMonth" });
  });

  it("lastMonth", () => {
    expect(resolveReportDateRange({ datePreset: "lastMonth" })).toEqual({ from: "2026-08-01", to: "2026-08-31", preset: "lastMonth" });
  });

  it("thisQuarter -- Sept 27 falls in Q3 (Jul-Sep)", () => {
    expect(resolveReportDateRange({ datePreset: "thisQuarter" })).toEqual({ from: "2026-07-01", to: "2026-09-30", preset: "thisQuarter" });
  });

  it("custom range, already in order", () => {
    expect(resolveReportDateRange({ datePreset: "custom", dateFrom: "2026-09-01", dateTo: "2026-09-10" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
      preset: "custom",
    });
  });

  it("custom range swaps an inverted from/to", () => {
    expect(resolveReportDateRange({ datePreset: "custom", dateFrom: "2026-09-10", dateTo: "2026-09-01" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
      preset: "custom",
    });
  });

  it("falls back to last30 when a custom range is missing from/to", () => {
    expect(resolveReportDateRange({ datePreset: "custom" })).toEqual({ from: "2026-08-29", to: "2026-09-27", preset: "last30" });
  });
});

describe("thisQuarter across quarter boundaries", () => {
  afterEach(() => vi.useRealTimers());

  it("January (Q1) resolves to Jan 1 - Mar 31", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-15T10:00:00Z"));
    expect(resolveReportDateRange({ datePreset: "thisQuarter" })).toEqual({ from: "2027-01-01", to: "2027-03-31", preset: "thisQuarter" });
  });

  it("December (Q4) resolves to Oct 1 - Dec 31", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-10T10:00:00Z"));
    expect(resolveReportDateRange({ datePreset: "thisQuarter" })).toEqual({ from: "2026-10-01", to: "2026-12-31", preset: "thisQuarter" });
  });
});
