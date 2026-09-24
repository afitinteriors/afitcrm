import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getUncontactedLeads } from "@/lib/leads";
import { getUnansweredConversations } from "@/lib/conversations";
import { OPEN_LEAD_STATUSES, FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { businessDate } from "@/lib/business-time";
import type { LeadStatus } from "@/lib/supabase/types";

// AFIT Follow-Up Brain -- Phase A (UI-only).
//
// Every query here uses ONLY existing tables/columns (leads, follow_ups,
// conversations, messages) and relies entirely on existing RLS
// (*_select_admin_or_owner) for staff/admin visibility -- there is no
// role check in this file beyond what's needed to short-circuit an
// unauthenticated request. No new column, table, trigger, or score is
// introduced. See docs/strategy/follow-up-brain/ for the strategy this
// implements (04_PRIORITY_AND_DUE_DATE_RULES.md in particular -- the tier
// order below is that document's MUST-HAVE signal list, made concrete).

export type DutyReasonKind =
  | "overdue_follow_up"
  | "due_today_follow_up"
  | "unanswered_conversation"
  | "uncontacted_lead"
  | "no_follow_up";

export type DutyItem = {
  key: string;
  tier: number;
  leadId: string | null;
  conversationId: string | null;
  followUpId: string | null;
  customerName: string;
  phone: string | null;
  stage: LeadStatus | null;
  assignedToName: string | null;
  reasonKind: DutyReasonKind;
  reasonText: string;
  actionLabel: string;
  sortAt: string; // ISO timestamp/date used to order items within a tier
};

// Tier order is the one deterministic rule this phase defines (per
// 04_PRIORITY_AND_DUE_DATE_RULES.md section A): overdue first, then due
// today, then the other MUST-HAVE attention signals in a fixed order so the
// result is always reproducible from the same data. This is an ordering
// rule over existing facts, not a score -- no numeric weight is assigned to
// any signal.
const TIER = {
  OVERDUE_FOLLOW_UP: 1,
  DUE_TODAY_FOLLOW_UP: 2,
  UNANSWERED_CONVERSATION: 3,
  UNCONTACTED_LEAD: 4,
  NO_FOLLOW_UP: 5,
} as const;

// "Today" for due-date comparisons is the business-zone (IST) calendar day --
// the same rule /today, /follow-ups and /site-visits use (lib/business-time.ts).
function todayIso(): string {
  return businessDate();
}

type FollowUpWithLead = {
  id: string;
  lead_id: string;
  type: string;
  due_date: string;
  due_time: string | null;
  notes: string | null;
  lead: { customer_name: string | null; phone: string; status: LeadStatus; assigned: { display_name: string | null } | null } | null;
};

// Pending follow-ups only, split into overdue / due-today by the caller.
// Excludes rows whose lead is missing or already closed (Won/Lost/Invalid)
// -- a closed lead should never generate a duty item, even if a stale
// follow-up row exists against it.
async function getPendingFollowUpsWithLead(): Promise<FollowUpWithLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("id, lead_id, type, due_date, due_time, notes, lead:leads(customer_name, phone, status, assigned:profiles(display_name))")
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FollowUpWithLead[]).filter(
    (f) => f.lead && OPEN_LEAD_STATUSES.includes(f.lead.status),
  );
}

type LeadForDuty = {
  id: string;
  customer_name: string | null;
  phone: string;
  status: LeadStatus;
  created_at: string;
  assigned: { display_name: string | null } | null;
};

// The set of lead ids that currently have at least one pending follow-up --
// computed once and reused by both the "uncontacted" and "no follow-up
// elsewhere" checks below, rather than querying follow_ups twice.
async function getLeadIdsWithPendingFollowUp(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("follow_ups").select("lead_id").eq("status", "pending");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((f) => f.lead_id));
}

async function getOpenLeadsWithoutPendingFollowUp(statuses: LeadStatus[], excludeIds: Set<string>): Promise<LeadForDuty[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, phone, status, created_at, assigned:profiles(display_name)")
    .in("status", statuses)
    .is("merged_into_id", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as LeadForDuty[]).filter((lead) => !excludeIds.has(lead.id));
}

export type DutyQueue = {
  items: DutyItem[];
  counts: {
    overdue: number;
    dueToday: number;
    unanswered: number;
    uncontacted: number;
    noFollowUp: number;
    stalledPipeline: number;
  };
};

// The current user's (staff or admin) unified attention queue, per
// 01_FOLLOW_UP_BRAIN_STRATEGY.md's loop and 04's tier rule. RLS already
// scopes every underlying query to what the caller may see -- a staff
// caller gets only their own assigned leads/conversations/follow-ups, an
// admin caller gets everything -- so this function needs no role branching
// itself; the *presentation* differs by role (see components/dashboard/).
export async function getMyDutyQueue(): Promise<DutyQueue> {
  const profile = await getCurrentProfile();
  if (!profile) return { items: [], counts: { overdue: 0, dueToday: 0, unanswered: 0, uncontacted: 0, noFollowUp: 0, stalledPipeline: 0 } };

  const today = todayIso();

  const [pendingFollowUps, unanswered, leadIdsWithFollowUp, uncontactedAll] = await Promise.all([
    getPendingFollowUpsWithLead(),
    getUnansweredConversations(),
    getLeadIdsWithPendingFollowUp(),
    getUncontactedLeads(),
  ]);

  const uncontactedLeads = uncontactedAll.filter((lead) => !leadIdsWithFollowUp.has(lead.id));
  const noFollowUpElsewhere = await getOpenLeadsWithoutPendingFollowUp(
    OPEN_LEAD_STATUSES.filter((s) => s !== "new"),
    leadIdsWithFollowUp,
  );

  const items: DutyItem[] = [];

  for (const f of pendingFollowUps) {
    if (!f.lead) continue;
    const overdue = f.due_date < today;
    const dueToday = f.due_date === today;
    if (!overdue && !dueToday) continue; // upcoming follow-ups aren't part of the attention queue itself
    items.push({
      key: `follow_up:${f.id}`,
      tier: overdue ? TIER.OVERDUE_FOLLOW_UP : TIER.DUE_TODAY_FOLLOW_UP,
      leadId: f.lead_id,
      conversationId: null,
      followUpId: f.id,
      customerName: f.lead.customer_name || "Unnamed lead",
      phone: f.lead.phone,
      stage: f.lead.status,
      assignedToName: f.lead.assigned?.display_name ?? null,
      reasonKind: overdue ? "overdue_follow_up" : "due_today_follow_up",
      reasonText: overdue
        ? `${FOLLOW_UP_TYPE_LABELS[f.type as keyof typeof FOLLOW_UP_TYPE_LABELS] ?? "Follow-up"} overdue since ${formatDate(f.due_date)}`
        : `${FOLLOW_UP_TYPE_LABELS[f.type as keyof typeof FOLLOW_UP_TYPE_LABELS] ?? "Follow-up"} due today`,
      actionLabel: "Complete follow-up",
      sortAt: f.due_date,
    });
  }

  for (const c of unanswered) {
    items.push({
      key: `conversation:${c.id}`,
      tier: TIER.UNANSWERED_CONVERSATION,
      leadId: c.lead?.id ?? null,
      conversationId: c.id,
      followUpId: null,
      customerName: c.lead?.customer_name || c.wa_id,
      phone: c.wa_id,
      stage: null,
      assignedToName: c.lead?.assigned?.display_name ?? null,
      reasonKind: "unanswered_conversation",
      reasonText: "Customer messaged on WhatsApp and hasn't had a reply yet",
      actionLabel: "Open conversation",
      sortAt: c.lastInboundAt,
    });
  }

  for (const lead of uncontactedLeads) {
    items.push({
      key: `uncontacted:${lead.id}`,
      tier: TIER.UNCONTACTED_LEAD,
      leadId: lead.id,
      conversationId: null,
      followUpId: null,
      customerName: lead.customer_name || "Unnamed lead",
      phone: lead.phone,
      stage: lead.status,
      assignedToName: lead.assigned?.display_name ?? null,
      reasonKind: "uncontacted_lead",
      reasonText: "New enquiry -- needs first contact",
      actionLabel: "Call customer",
      sortAt: lead.created_at,
    });
  }

  for (const lead of noFollowUpElsewhere) {
    items.push({
      key: `no_follow_up:${lead.id}`,
      tier: TIER.NO_FOLLOW_UP,
      leadId: lead.id,
      conversationId: null,
      followUpId: null,
      customerName: lead.customer_name || "Unnamed lead",
      phone: lead.phone,
      stage: lead.status,
      assignedToName: lead.assigned?.display_name ?? null,
      reasonKind: "no_follow_up",
      reasonText: "No follow-up has been scheduled for this lead",
      actionLabel: "Open lead",
      sortAt: lead.created_at,
    });
  }

  items.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime()));

  // The same lead can legitimately trigger more than one signal at once
  // (e.g. an unanswered conversation AND no follow-up scheduled -- this is
  // the everyday shape of a brand-new WhatsApp enquiry, not an edge case).
  // The *displayed* queue shows that lead once, under its highest-tier
  // (most urgent) reason -- items are already tier-sorted above, so keeping
  // the first occurrence per lead id is sufficient.
  const seenLeadIds = new Set<string>();
  const dedupedItems = items.filter((item) => {
    if (!item.leadId) return true;
    if (seenLeadIds.has(item.leadId)) return false;
    seenLeadIds.add(item.leadId);
    return true;
  });

  // Counts MUST be derived from dedupedItems, not the raw per-signal source
  // arrays (unanswered/uncontactedLeads/noFollowUpElsewhere/items) -- a lead
  // that trips two signals at once is shown once in the list (above), and a
  // stat tile built from the raw arrays would silently count it twice,
  // disagreeing with what's actually visible when you click through. This
  // was a real bug (2026-09 Duty Architecture Audit, finding C(i)): e.g. a
  // fresh WhatsApp lead is simultaneously "unanswered" and "uncontacted",
  // so the old raw counts double-counted every such lead into both tiles.
  const countByReason = (reasonKind: DutyReasonKind) => dedupedItems.filter((i) => i.reasonKind === reasonKind).length;
  const stalledPipeline = dedupedItems.filter(
    (i) => i.reasonKind === "no_follow_up" && (i.stage === "quotation" || i.stage === "negotiation"),
  ).length;

  return {
    items: dedupedItems,
    counts: {
      overdue: countByReason("overdue_follow_up"),
      dueToday: countByReason("due_today_follow_up"),
      unanswered: countByReason("unanswered_conversation"),
      uncontacted: countByReason("uncontacted_lead"),
      noFollowUp: countByReason("no_follow_up"),
      stalledPipeline,
    },
  };
}

export type StalledPipelineLead = {
  id: string;
  customer_name: string | null;
  phone: string;
  status: LeadStatus;
  quotation_amount: number | null;
  job_value: number | null;
  created_at: string;
  assigned: { display_name: string | null } | null;
};

// Quotation/Negotiation leads with no pending follow-up at all -- the
// "pipeline at risk" zero-miss signal from 05_ADMIN_STAFF_DUTY_MODEL.md,
// scoped by whatever the caller's RLS already allows.
export async function getStalledPipelineLeads(): Promise<StalledPipelineLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const [{ data: leadsData, error: leadsError }, { data: followUpsData, error: followUpsError }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, customer_name, phone, status, quotation_amount, job_value, created_at, assigned:profiles(display_name)")
      .in("status", ["quotation", "negotiation"])
      .is("merged_into_id", null)
      .order("created_at", { ascending: true }),
    supabase.from("follow_ups").select("lead_id").eq("status", "pending"),
  ]);
  if (leadsError) throw new Error(leadsError.message);
  if (followUpsError) throw new Error(followUpsError.message);

  const leadsWithFollowUp = new Set((followUpsData ?? []).map((f) => f.lead_id));
  return ((leadsData ?? []) as unknown as StalledPipelineLead[]).filter((lead) => !leadsWithFollowUp.has(lead.id));
}

export type UnassignedLead = {
  id: string;
  customer_name: string | null;
  phone: string;
  status: LeadStatus;
  created_at: string;
};

// Admin-only in practice (RLS gives staff nothing useful here, since an
// unassigned lead can't belong to any staff member) -- no role check is
// enforced in this function itself; the page decides who it's shown to.
export async function getUnassignedLeads(): Promise<UnassignedLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, phone, status, created_at")
    .is("assigned_to_id", null)
    .in("status", OPEN_LEAD_STATUSES)
    .is("merged_into_id", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as UnassignedLead[];
}

export type RecentLead = {
  id: string;
  customer_name: string | null;
  phone: string;
  status: LeadStatus;
  source: string | null;
  created_at: string;
};

// Lightweight "what's coming in" list for the Admin dashboard's Recent
// Activity section -- the most recently created leads, regardless of
// source or assignment. Not a general activity feed (no new table for
// that in this phase); just the one recent-activity signal that's cheap
// and meaningful with existing columns.
export async function getRecentLeads(limit = 5): Promise<RecentLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, phone, status, source, created_at")
    .is("merged_into_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as RecentLead[];
}

export type StaffWorkloadRow = {
  staffId: string;
  displayName: string | null;
  openLeads: number;
  overdueFollowUps: number;
};

// Admin-only in practice -- a staff caller's RLS already narrows both
// queries below to their own rows, so this would just report on themself;
// the admin dashboard is the only place this is rendered.
export async function getStaffWorkload(): Promise<StaffWorkloadRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const today = todayIso();

  const [{ data: profiles, error: profilesError }, { data: leads, error: leadsError }, { data: followUps, error: followUpsError }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name").eq("role", "staff"),
      supabase.from("leads").select("id, assigned_to_id").in("status", OPEN_LEAD_STATUSES).is("merged_into_id", null),
      supabase.from("follow_ups").select("lead_id, due_date, status").eq("status", "pending").lt("due_date", today),
    ]);
  if (profilesError) throw new Error(profilesError.message);
  if (leadsError) throw new Error(leadsError.message);
  if (followUpsError) throw new Error(followUpsError.message);

  const leadOwner = new Map<string, string | null>();
  for (const l of leads ?? []) leadOwner.set(l.id, l.assigned_to_id);

  return (profiles ?? []).map((p) => {
    const openLeads = (leads ?? []).filter((l) => l.assigned_to_id === p.id).length;
    const overdueFollowUps = (followUps ?? []).filter((f) => leadOwner.get(f.lead_id) === p.id).length;
    return { staffId: p.id, displayName: p.display_name, openLeads, overdueFollowUps };
  });
}
