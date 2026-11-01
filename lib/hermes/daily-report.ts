import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { businessDateOf, businessDayRangeToUtcBounds } from "@/lib/business-time";
import { RESPONSE_ALERT_STAFF_MINUTES } from "@/lib/constants";

export type StaffDailyReport = {
  staffId: string;
  displayName: string | null;
  leadsIn: number;
  called: number;
  respondedUnder15Min: number;
  visitsFixed: number;
  quotesSent: number;
  won: number;
  lost: number;
};

function countByKey(rows: { key: string | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.key) continue;
    counts.set(row.key, (counts.get(row.key) ?? 0) + 1);
  }
  return counts;
}

// Blueprint V1 Section 9, Phase 5: the "Nightly report" job's exact shape --
// "Leads in, called, first response under 15 min, visits fixed, quotes
// sent, won, lost, per staff" at 20:00 daily. Distinct from
// dashboard-brain.ts's getTeamPerformance() (lifetime totals for the admin
// dashboard, scoped to the logged-in user via getCurrentProfile) -- this is
// a single calendar day, across the whole team, for a caller with no
// session at all. "Called"/"won"/"lost"/"quotes sent" reuse the same
// approximations already established elsewhere in this codebase
// (getTodayActivityCounts, getRevenueOverview) rather than inventing new
// ones -- see each section's own comment below.
export async function getDailyReport(supabase: SupabaseClient<Database>, date: string): Promise<StaffDailyReport[]> {
  const bounds = businessDayRangeToUtcBounds(date, date);
  if (!bounds) return [];
  const { startIso, endExclusiveIso } = bounds;

  const [{ data: profiles }, { data: newLeads }, { data: calls }, { data: visitLeads }, { data: quotedLeads }, { data: wonLeads }, { data: lostLeads }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name").eq("role", "staff"),
      supabase.from("leads").select("id, assigned_to_id, created_at").is("merged_into_id", null).gte("created_at", startIso).lt("created_at", endExclusiveIso),
      supabase.from("call_logs").select("caller_id").gte("resolved_at", startIso).lt("resolved_at", endExclusiveIso),
      // Not date-bounded by created_at -- any lead whose *visit* calendar
      // day is `date`, whenever it was scheduled.
      supabase.from("leads").select("assigned_to_id, site_visit_date").is("merged_into_id", null).not("site_visit_date", "is", null),
      // Same "no dedicated quoted-at timestamp" approximation as
      // getTodayActivityCounts()'s "estimates" / getRevenueOverview(): use
      // updated_at as the best available proxy.
      supabase
        .from("leads")
        .select("assigned_to_id")
        .is("merged_into_id", null)
        .not("quotation_amount", "is", null)
        .gte("updated_at", startIso)
        .lt("updated_at", endExclusiveIso),
      supabase.from("leads").select("assigned_to_id").eq("status", "won").gte("status_changed_at", startIso).lt("status_changed_at", endExclusiveIso),
      supabase.from("leads").select("assigned_to_id").eq("status", "lost").gte("status_changed_at", startIso).lt("status_changed_at", endExclusiveIso),
    ]);

  const leadsInByStaff = countByKey((newLeads ?? []).map((l) => ({ key: l.assigned_to_id })));
  const calledByStaff = countByKey((calls ?? []).map((c) => ({ key: c.caller_id })));
  const visitsFixedByStaff = countByKey(
    (visitLeads ?? []).filter((l) => l.site_visit_date && businessDateOf(l.site_visit_date) === date).map((l) => ({ key: l.assigned_to_id })),
  );
  const quotesSentByStaff = countByKey((quotedLeads ?? []).map((l) => ({ key: l.assigned_to_id })));
  const wonByStaff = countByKey((wonLeads ?? []).map((l) => ({ key: l.assigned_to_id })));
  const lostByStaff = countByKey((lostLeads ?? []).map((l) => ({ key: l.assigned_to_id })));

  const respondedUnder15ByStaff = await countRespondedUnder15Min(supabase, newLeads ?? []);

  return (profiles ?? []).map((p) => ({
    staffId: p.id,
    displayName: p.display_name,
    leadsIn: leadsInByStaff.get(p.id) ?? 0,
    called: calledByStaff.get(p.id) ?? 0,
    respondedUnder15Min: respondedUnder15ByStaff.get(p.id) ?? 0,
    visitsFixed: visitsFixedByStaff.get(p.id) ?? 0,
    quotesSent: quotesSentByStaff.get(p.id) ?? 0,
    won: wonByStaff.get(p.id) ?? 0,
    lost: lostByStaff.get(p.id) ?? 0,
  }));
}

// R-LEAD-003's own "response" definition (lib/rules/response-timer.ts's
// findUnrespondedLeads): a resolved call_logs row OR an outbound message.
// For each of today's new leads, the earliest of those two counts as the
// response instant; under RESPONSE_ALERT_STAFF_MINUTES of the lead's
// created_at is "responded under 15 min," credited to the LEAD's assignee
// (who the lead was handled by), not necessarily who logged the call.
async function countRespondedUnder15Min(
  supabase: SupabaseClient<Database>,
  newLeads: { id: string; assigned_to_id: string | null; created_at: string }[],
): Promise<Map<string, number>> {
  if (newLeads.length === 0) return new Map();
  const leadIds = newLeads.map((l) => l.id);

  const [{ data: callRows }, { data: conversationRows }] = await Promise.all([
    supabase.from("call_logs").select("lead_id, resolved_at").in("lead_id", leadIds).not("resolved_at", "is", null),
    supabase.from("conversations").select("id, lead_id").in("lead_id", leadIds),
  ]);

  const earliestByLead = new Map<string, number>();
  const note = (leadId: string, instant: number) => {
    const existing = earliestByLead.get(leadId);
    if (existing === undefined || instant < existing) earliestByLead.set(leadId, instant);
  };
  for (const c of callRows ?? []) {
    if (c.resolved_at) note(c.lead_id, new Date(c.resolved_at).getTime());
  }

  const conversations = conversationRows ?? [];
  if (conversations.length > 0) {
    const conversationToLead = new Map(conversations.map((c) => [c.id, c.lead_id]));
    const { data: outboundRows } = await supabase
      .from("messages")
      .select("conversation_id, created_at")
      .in(
        "conversation_id",
        conversations.map((c) => c.id),
      )
      .eq("direction", "outbound");
    for (const m of outboundRows ?? []) {
      const leadId = conversationToLead.get(m.conversation_id);
      if (leadId) note(leadId, new Date(m.created_at).getTime());
    }
  }

  const counts = new Map<string, number>();
  for (const lead of newLeads) {
    if (!lead.assigned_to_id) continue;
    const responseInstant = earliestByLead.get(lead.id);
    if (responseInstant === undefined) continue;
    const minutes = (responseInstant - new Date(lead.created_at).getTime()) / 60_000;
    if (minutes <= RESPONSE_ALERT_STAFF_MINUTES) {
      counts.set(lead.assigned_to_id, (counts.get(lead.assigned_to_id) ?? 0) + 1);
    }
  }
  return counts;
}
