// Pure date-preset resolution for the Reports page's reporting-period
// filter. Deliberately separate from lib/lead-date-filters.ts (the Leads
// list's Created-date filter) even though the preset shapes are similar --
// Reports needs a "This Quarter" preset the Leads list doesn't, and this
// keeps that addition from silently appearing as a new option on the Leads
// page's own filter, which shares no code with this file. Zero server-only
// imports, so it's safe for a client component to import directly.
import { businessDate, businessDatePlusDays, businessMonthRange } from "@/lib/business-time";

export const REPORT_DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 Days" },
  { id: "last30", label: "Last 30 Days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "thisQuarter", label: "This Quarter" },
  { id: "custom", label: "Custom Range" },
] as const;
export type ReportDatePreset = (typeof REPORT_DATE_PRESETS)[number]["id"];

const REPORT_DATE_PRESET_IDS = REPORT_DATE_PRESETS.map((p) => p.id) as string[];
export function isReportDatePreset(value: string): value is ReportDatePreset {
  return REPORT_DATE_PRESET_IDS.includes(value);
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ReportDateFilterInput = {
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
};

// Current business quarter, full calendar span (e.g. Jul 1 - Sep 30 for
// Q3), same "full period" convention as thisMonth/lastMonth -- not
// quarter-to-date. Reuses businessMonthRange's own arithmetic for both
// boundaries rather than a new date-math routine.
function thisQuarterRange(): { from: string; to: string } {
  const [, m] = businessDate().split("-").map(Number);
  const currentMonth0 = m - 1;
  const quarterStartMonth0 = Math.floor(currentMonth0 / 3) * 3;
  const quarterEndMonth0 = quarterStartMonth0 + 2;
  const monthsAgoStart = currentMonth0 - quarterStartMonth0;
  const monthsAgoEnd = currentMonth0 - quarterEndMonth0;
  return { from: businessMonthRange(monthsAgoStart).from, to: businessMonthRange(monthsAgoEnd).to };
}

// Resolves the reporting-period preset/custom range into a concrete,
// inclusive [from, to] business-day pair. Defaults to "last30" when no
// preset is given/recognised -- a sensible management-report default that
// never silently reports on zero data. Custom range accepts the two dates
// in either order.
export function resolveReportDateRange(filters: ReportDateFilterInput): { from: string; to: string; preset: ReportDatePreset } {
  const preset = filters.datePreset && isReportDatePreset(filters.datePreset) ? filters.datePreset : "last30";

  if (preset === "custom") {
    const from = filters.dateFrom && DAY_PATTERN.test(filters.dateFrom) ? filters.dateFrom : null;
    const to = filters.dateTo && DAY_PATTERN.test(filters.dateTo) ? filters.dateTo : null;
    if (from && to) {
      return from <= to ? { from, to, preset } : { from: to, to: from, preset };
    }
    // Incomplete custom range: fall back to last30 rather than an
    // unbounded/invalid query.
    const today = businessDate();
    return { from: businessDatePlusDays(-29), to: today, preset: "last30" };
  }

  const today = businessDate();
  switch (preset) {
    case "today":
      return { from: today, to: today, preset };
    case "last7":
      return { from: businessDatePlusDays(-6), to: today, preset };
    case "last30":
      return { from: businessDatePlusDays(-29), to: today, preset };
    case "thisMonth":
      return { ...businessMonthRange(0), preset };
    case "lastMonth":
      return { ...businessMonthRange(1), preset };
    case "thisQuarter":
      return { ...thisQuarterRange(), preset };
  }
}
