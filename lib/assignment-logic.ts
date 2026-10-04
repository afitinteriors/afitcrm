import { businessDate, businessDateOf } from "@/lib/business-time";

// Pure assignment logic: no database, no server-only imports, so it can be
// unit-tested directly and reused by any future routing engine. Nothing here
// changes an assignment -- it only describes the current state.

const MS_PER_HOUR = 60 * 60 * 1000;
export const OLDER_THAN_HOURS = 24;
// Largest bulk selection accepted in one assignment action.
export const MAX_BULK_ASSIGN = 100;

// Lead age is always measured from leads.created_at (the one timestamp every
// lead has), in whole hours.
export function leadAgeHours(createdAt: string, now: Date): number {
  return Math.max(0, (now.getTime() - new Date(createdAt).getTime()) / MS_PER_HOUR);
}

export function isOlderThan24h(createdAt: string, now: Date): boolean {
  return leadAgeHours(createdAt, now) >= OLDER_THAN_HOURS;
}

// "Today" uses the business time zone, the same rule the dashboards use.
export function isCreatedToday(createdAt: string, now: Date): boolean {
  return businessDateOf(createdAt) === businessDate(now);
}

// Oldest first, so the leads that have waited longest are surfaced first.
export function sortUnassignedOldestFirst<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export type UnassignedSummary = { total: number; olderThan24h: number; createdToday: number };

export function summarizeUnassigned(rows: { created_at: string }[], now: Date): UnassignedSummary {
  return {
    total: rows.length,
    olderThan24h: rows.filter((r) => isOlderThan24h(r.created_at, now)).length,
    createdToday: rows.filter((r) => isCreatedToday(r.created_at, now)).length,
  };
}

export type StaffWorkloadItem = { staffId: string; displayName: string; activeLeads: number };

// Real open-lead counts per staff member. Staff with no open leads still
// appear (count 0). Sorted by fewest active leads, then name, so the list is
// stable. There is no configured capacity in the data model, so no capacity
// value is computed or shown.
export function buildStaffWorkload(
  staff: { id: string; display_name: string | null }[],
  openLeads: { assigned_to_id: string | null }[],
): StaffWorkloadItem[] {
  const counts = new Map<string, number>();
  for (const lead of openLeads) {
    if (lead.assigned_to_id) counts.set(lead.assigned_to_id, (counts.get(lead.assigned_to_id) ?? 0) + 1);
  }
  return staff
    .map((s) => ({ staffId: s.id, displayName: s.display_name || "Unnamed staff", activeLeads: counts.get(s.id) ?? 0 }))
    .sort((a, b) => a.activeLeads - b.activeLeads || a.displayName.localeCompare(b.displayName));
}

// The staff member with the lowest current workload. Labelled in the UI as a
// workload-based suggestion only -- it never assigns anything.
export function lowestWorkloadStaffId(items: StaffWorkloadItem[]): string | null {
  return items.length > 0 ? items[0].staffId : null;
}

export type AssignmentHistoryEntry =
  | { kind: "created"; at: string }
  | { kind: "assigned"; at: string; actorName: string; toName: string }
  | { kind: "reassigned"; at: string; actorName: string; fromName: string; toName: string }
  | { kind: "assigned_unknown_previous"; at: string; actorName: string; toName: string };

// Turns the raw audit events for one lead into readable history lines.
// Events recorded before previous/new staff were stored have no metadata, so
// they are reported as "assigned" with no previous owner rather than guessed.
export function describeAssignmentEvent(
  event: { created_at: string; actorName: string; metadata: { previous_staff_id?: string | null; new_staff_id?: string | null } | null },
  names: Map<string, string>,
): AssignmentHistoryEntry {
  const meta = event.metadata;
  const newId = meta?.new_staff_id ?? null;
  const prevId = meta?.previous_staff_id ?? null;
  const toName = newId ? names.get(newId) ?? "Unknown staff" : "Unknown staff";

  if (!meta || meta.previous_staff_id === undefined) {
    return { kind: "assigned_unknown_previous", at: event.created_at, actorName: event.actorName, toName };
  }
  if (!prevId) return { kind: "assigned", at: event.created_at, actorName: event.actorName, toName };
  return {
    kind: "reassigned",
    at: event.created_at,
    actorName: event.actorName,
    fromName: names.get(prevId) ?? "Unknown staff",
    toName,
  };
}
