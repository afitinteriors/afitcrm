import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadRow } from "@/lib/supabase/types";
import { RESPONSE_ALERT_STAFF_MINUTES, RESPONSE_ALERT_OWNER_MINUTES } from "@/lib/constants";

export type UnrespondedLead = Pick<LeadRow, "id" | "customer_name" | "phone" | "assigned_to_id" | "created_at">;

export type ResponseTimerBuckets = {
  overdueStaff: UnrespondedLead[];
  overdueOwner: UnrespondedLead[];
};

// Pure half of R-LEAD-003 (docs/BLUEPRINT_V1.md Section 8): given leads
// already known to have no response evidence (findUnrespondedLeads below),
// split them by how overdue they are. A lead past 30 minutes lands in BOTH
// buckets -- it still needs the 15-min staff alert (its dedupe_key just
// already exists by then, see app/api/cron/response-timer/route.ts) as well
// as the 30-min owner escalation.
export function bucketByOverdue(leads: UnrespondedLead[], now: Date): ResponseTimerBuckets {
  const overdueStaff: UnrespondedLead[] = [];
  const overdueOwner: UnrespondedLead[] = [];

  for (const lead of leads) {
    const minutesSinceCreated = (now.getTime() - new Date(lead.created_at).getTime()) / 60_000;
    if (minutesSinceCreated >= RESPONSE_ALERT_STAFF_MINUTES) overdueStaff.push(lead);
    if (minutesSinceCreated >= RESPONSE_ALERT_OWNER_MINUTES) overdueOwner.push(lead);
  }

  return { overdueStaff, overdueOwner };
}

// Candidate leads for R-LEAD-003: created at least RESPONSE_ALERT_STAFF_MINUTES
// ago, not already closed/disqualified (won/lost/invalid, or merged into
// another lead), and with no evidence of a first response yet -- neither a
// resolved call_logs row nor an outbound WhatsApp message. "Response"
// deliberately covers both channels: this app's leads are handled by phone
// (call_logs) and by WhatsApp conversation (messages), and either one is a
// real first response, not just a call.
export async function findUnrespondedLeads(supabase: SupabaseClient<Database>, now: Date): Promise<UnrespondedLead[]> {
  const cutoff = new Date(now.getTime() - RESPONSE_ALERT_STAFF_MINUTES * 60_000).toISOString();

  const { data: candidateRows } = await supabase
    .from("leads")
    .select("id, customer_name, phone, assigned_to_id, created_at")
    .not("status", "in", "(won,lost,invalid)")
    .is("merged_into_id", null)
    .lte("created_at", cutoff);

  const candidates = (candidateRows ?? []) as UnrespondedLead[];
  if (candidates.length === 0) return [];

  const leadIds = candidates.map((l) => l.id);

  const [{ data: callRows }, { data: conversationRows }] = await Promise.all([
    supabase.from("call_logs").select("lead_id").in("lead_id", leadIds).not("resolved_at", "is", null),
    supabase.from("conversations").select("id, lead_id").in("lead_id", leadIds),
  ]);

  const respondedByCall = new Set((callRows ?? []).map((c) => c.lead_id));

  const conversations = conversationRows ?? [];
  const respondedByMessage = new Set<string>();
  if (conversations.length > 0) {
    const conversationToLead = new Map(conversations.map((c) => [c.id, c.lead_id]));
    const { data: outboundRows } = await supabase
      .from("messages")
      .select("conversation_id")
      .in(
        "conversation_id",
        conversations.map((c) => c.id),
      )
      .eq("direction", "outbound");

    for (const m of outboundRows ?? []) {
      const leadId = conversationToLead.get(m.conversation_id);
      if (leadId) respondedByMessage.add(leadId);
    }
  }

  return candidates.filter((l) => !respondedByCall.has(l.id) && !respondedByMessage.has(l.id));
}
