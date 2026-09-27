// Pure date-preset resolution for the Leads list's Created-date filter --
// deliberately has zero server-only imports (no supabase/server, no auth) so
// it can be safely imported from both the server data layer (lib/leads.ts)
// and the client-side filter bar, without pulling server code into the
// client bundle.
import { businessDate, businessDatePlusDays, businessMonthRange } from "@/lib/business-time";

// "custom" is the only preset that reads dateFrom/dateTo; every other preset
// is always resolved against *now* (see resolveDateRange), so a
// bookmarked/refreshed "Today" link keeps meaning today, not the day it was
// first bookmarked.
export const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "custom", label: "Custom range" },
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number]["id"];

const DATE_PRESET_IDS = DATE_PRESETS.map((p) => p.id) as string[];
export function isDatePreset(value: string): value is DatePreset {
  return DATE_PRESET_IDS.includes(value);
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DateFilterInput = {
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
};

// Resolves the filter's date preset/custom range into a concrete, inclusive
// [from, to] business-day pair, or null when no (valid) date filter is
// active. Custom range accepts the two dates in either order.
export function resolveDateRange(filters: DateFilterInput): { from: string; to: string } | null {
  const preset = filters.datePreset && isDatePreset(filters.datePreset) ? filters.datePreset : null;
  if (!preset) return null;

  if (preset === "custom") {
    const from = filters.dateFrom && DAY_PATTERN.test(filters.dateFrom) ? filters.dateFrom : null;
    const to = filters.dateTo && DAY_PATTERN.test(filters.dateTo) ? filters.dateTo : null;
    if (!from || !to) return null;
    return from <= to ? { from, to } : { from: to, to: from };
  }

  const today = businessDate();
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = businessDatePlusDays(-1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: businessDatePlusDays(-6), to: today };
    case "last30":
      return { from: businessDatePlusDays(-29), to: today };
    case "thisMonth":
      return businessMonthRange(0);
    case "lastMonth":
      return businessMonthRange(1);
  }
}
