import type { DutyItem } from "@/lib/dashboard-brain";

// One lead -> one current operational queue location. Pure filters over
// already-fetched rows; no ranking, schema, or query change.

// Staff: the item chosen as "My Duty Now" must not repeat in the derived
// "Needs a Next Step" list. Matches by item key, or by lead when the item
// has one (a lead can surface as more than one item).
export function excludeDutyNow(items: DutyItem[], dutyNow: DutyItem | null): DutyItem[] {
  if (!dutyNow) return items;
  return items.filter((i) => i.key !== dutyNow.key && !(dutyNow.leadId !== null && i.leadId === dutyNow.leadId));
}

// Admin: Pipeline Attention yields to any lead already shown in an earlier
// derived list (Unassigned / Unanswered / Leads Without a Follow-up).
export function excludeLeadIds<T extends { id: string }>(rows: T[], claimedLeadIds: Set<string>): T[] {
  return rows.filter((r) => !claimedLeadIds.has(r.id));
}
