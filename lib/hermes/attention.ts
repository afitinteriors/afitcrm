import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadRow } from "@/lib/supabase/types";
import { bucketByOverdue, findUnrespondedLeads } from "@/lib/rules/response-timer";
import { bucketStageOverdue, findStageTrackedLeads } from "@/lib/rules/stage-timer";
import { businessDate } from "@/lib/business-time";
import { privacySafeLeadReference } from "@/lib/hermes/agent-events";

export type AttentionReasonKind = "unresponded" | "stage_overdue" | "overdue_follow_up";

export type AttentionItem = {
  reference: string; // privacy-safe, see privacySafeLeadReference -- no phone/name
  crmUrl: string; // "details open from a CRM link" (Section 9's privacy rule)
  reasonKind: AttentionReasonKind;
  assignedToId: string | null;
};

type PrivacySafeLead = Pick<LeadRow, "id" | "location" | "service_required" | "project_type" | "assigned_to_id">;

// Blueprint V1 Section 9: Hermes's "Response chase" (every 15 min) and
// "Morning list" (9:00 daily) jobs both need "what needs attention right
// now" -- this is that feed. Deliberately reuses the existing R-LEAD-003/
// R-STAGE-002 rule functions for WHICH leads are overdue (one source of
// truth, same as the cron routes), but never their raw output: those
// functions select customer_name/phone for internal (staff-facing) alerts,
// which this function must never expose to Hermes. A separate, explicitly
// privacy-safe re-query by id is the whole point of this file, not an
// optimization to skip.
//
// Overdue follow-ups (R-FUP-001) are queried directly here -- a plain
// status/due_date filter needs no response-evidence cross-referencing, so
// there was no existing admin-client function to reuse.
//
// Scope, deliberately narrower than the blueprint's full "Morning list"
// (today's calls, visits and overdue follow-ups): this covers the three
// rule-based overdue categories with admin-client-ready logic already in
// this codebase. Unanswered conversations and uncontacted leads (part of
// the UI's own "duty queue", lib/duty.ts) are left for a later increment --
// their current implementation is scoped to the logged-in user
// (getCurrentProfile()), not the cross-staff view Hermes needs.
export async function getAttentionItems(supabase: SupabaseClient<Database>, now: Date): Promise<AttentionItem[]> {
  const today = businessDate(now);

  const [unresponded, stageTracked, overdueFollowUpRows] = await Promise.all([
    findUnrespondedLeads(supabase, now),
    findStageTrackedLeads(supabase),
    supabase.from("follow_ups").select("lead_id, assigned_to_id").eq("status", "pending").lte("due_date", today),
  ]);

  const { overdueStaff: unrespondedIds } = bucketByOverdue(unresponded, now);
  const { overdueStaff: stageOverdueIds } = bucketStageOverdue(stageTracked, now);
  const overdueFollowUps = overdueFollowUpRows.data ?? [];

  const leadIds = new Set<string>([
    ...unrespondedIds.map((l) => l.id),
    ...stageOverdueIds.map((l) => l.id),
    ...overdueFollowUps.map((f) => f.lead_id),
  ]);
  if (leadIds.size === 0) return [];

  const { data: leadRows } = await supabase
    .from("leads")
    .select("id, location, service_required, project_type, assigned_to_id")
    .in("id", Array.from(leadIds));
  const leadsById = new Map((leadRows ?? []).map((l) => [l.id, l as PrivacySafeLead]));

  const items: AttentionItem[] = [];
  const pushItem = (leadId: string, reasonKind: AttentionReasonKind, assignedToId: string | null) => {
    const lead = leadsById.get(leadId);
    if (!lead) return; // row vanished between the two queries -- skip, don't guess
    items.push({
      reference: privacySafeLeadReference(lead),
      crmUrl: `/leads/${leadId}`,
      reasonKind,
      assignedToId,
    });
  };

  for (const l of unrespondedIds) pushItem(l.id, "unresponded", l.assigned_to_id);
  for (const l of stageOverdueIds) pushItem(l.id, "stage_overdue", l.assigned_to_id);
  for (const f of overdueFollowUps) pushItem(f.lead_id, "overdue_follow_up", f.assigned_to_id);

  return items;
}
