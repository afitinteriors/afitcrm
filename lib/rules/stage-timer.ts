import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadRow, LeadStatus } from "@/lib/supabase/types";

export type StageTrackedLead = Pick<
  LeadRow,
  "id" | "customer_name" | "phone" | "assigned_to_id" | "status" | "status_changed_at" | "site_visit_date" | "quotation_amount"
>;

// R-STAGE-002 (docs/BLUEPRINT_V1.md Section 8): "Each stage has a time
// limit; overdue deals turn red." This is a narrowed subset of Section 7's
// full 9-stage pipeline table, mapped onto this app's actual 6 open
// lead.status values -- the ones with a clear, single-field basis for
// "when did the clock start":
//   - qualified: Section 7's "2 days to fix a visit", counted from
//     status_changed_at.
//   - site_visit: Section 7's "Visit done: 2 days to send quote" AND
//     R-STAGE-002's own worked example ("Visit Done, no quote in 2 days") --
//     counted from site_visit_date (not status_changed_at), since this
//     app's single "site_visit" status covers both "scheduled" and "done"
//     and site_visit_date is the one field that actually marks when the
//     visit happened.
//   - negotiation: Section 7's "7 days", counted from status_changed_at.
// Deliberately NOT covered here (flagged, not silently dropped):
//   - "new" (R-LEAD-003 already owns this, see lib/rules/response-timer.ts)
//   - "contacted" (Section 7 lists no time limit: "—")
//   - "quotation" (Section 7 describes a day-1/3/7 FOLLOW-UP cadence, not a
//     single hard "turns red" limit -- already partly served by the
//     existing follow_ups feature; a real R-STAGE-002 treatment of it is
//     future work)
const STAGE_LIMIT_DAYS: Partial<Record<LeadStatus, number>> = {
  qualified: 2,
  negotiation: 7,
};

const SITE_VISIT_FOLLOWUP_LIMIT_DAYS = 2;

// How much longer, past the limit, before the owner also gets alerted.
// Section 8's R-STAGE-002 row says only "Staff, then owner" with no exact
// timing (unlike R-LEAD-003/004, which give exact minutes) -- one extra day
// of grace for staff to act before escalating is this implementation's own
// reasonable default, not a number from the blueprint.
const OWNER_ESCALATION_GRACE_DAYS = 1;

function daysSince(timestamp: string, now: Date): number {
  return (now.getTime() - new Date(timestamp).getTime()) / 86_400_000;
}

// How many days this lead has been over its stage's limit (0 if not
// overdue, or if its status has no limit / site_visit has no visit date
// yet to measure against).
export function overdueStageDays(lead: StageTrackedLead, now: Date): number {
  if (lead.status === "site_visit") {
    // No visit date recorded yet: nothing to measure the 2-day "since the
    // visit" window against (known limitation -- a visit that was never
    // dated is not caught by this rule at all).
    if (!lead.site_visit_date) return 0;
    if (lead.quotation_amount !== null) return 0; // quote already sent
    const over = daysSince(lead.site_visit_date, now) - SITE_VISIT_FOLLOWUP_LIMIT_DAYS;
    return over > 0 ? over : 0;
  }

  const limitDays = STAGE_LIMIT_DAYS[lead.status];
  if (!limitDays) return 0;
  const over = daysSince(lead.status_changed_at, now) - limitDays;
  return over > 0 ? over : 0;
}

export type StageOverdueBuckets = {
  overdueStaff: StageTrackedLead[];
  overdueOwner: StageTrackedLead[];
};

export function bucketStageOverdue(leads: StageTrackedLead[], now: Date): StageOverdueBuckets {
  const overdueStaff: StageTrackedLead[] = [];
  const overdueOwner: StageTrackedLead[] = [];

  for (const lead of leads) {
    const overDays = overdueStageDays(lead, now);
    if (overDays <= 0) continue;
    overdueStaff.push(lead);
    if (overDays >= OWNER_ESCALATION_GRACE_DAYS) overdueOwner.push(lead);
  }

  return { overdueStaff, overdueOwner };
}

const TRACKED_STATUSES: LeadStatus[] = ["qualified", "site_visit", "negotiation"];

export async function findStageTrackedLeads(supabase: SupabaseClient<Database>): Promise<StageTrackedLead[]> {
  const { data } = await supabase
    .from("leads")
    .select("id, customer_name, phone, assigned_to_id, status, status_changed_at, site_visit_date, quotation_amount")
    .in("status", TRACKED_STATUSES)
    .is("merged_into_id", null);

  return (data ?? []) as StageTrackedLead[];
}
