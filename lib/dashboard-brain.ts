import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getUncontactedLeads } from "@/lib/leads";
import { getUnansweredConversations } from "@/lib/conversations";
import { OPEN_LEAD_STATUSES, LEAD_SOURCE_LABELS } from "@/lib/constants";
import {
  businessDate,
  businessDateOf,
  businessDatePlusDays,
  businessDayRangeToUtcBounds,
  businessMonthRange,
  toBusinessDateTimeLocal,
} from "@/lib/business-time";
import type { FollowUpType, LeadStatus } from "@/lib/supabase/types";
import { buildDutyItems, type DutyFollowUpWithLead, type DutyLeadWithoutFollowUp, type DutyItem, type DutyReasonKind } from "@/lib/duty";

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
//
// Duty Architecture Audit (2026-09) Phase 2: the actual signal-building/
// priority/dedup logic now lives in lib/duty.ts (buildDutyItems), the ONE
// canonical Duty derivation shared with lib/today.ts -- this file is only
// responsible for fetching the raw, RLS-scoped signals and handing them to
// it. DutyItem/DutyReasonKind are re-exported here unchanged so every
// existing `import { DutyItem, ... } from "@/lib/dashboard-brain"` (Staff/
// AdminHome, DutyList, the Follow-ups views) keeps working without change.
export type { DutyItem, DutyReasonKind };

// "Today" for due-date comparisons is the business-zone (IST) calendar day --
// the same rule /today, /follow-ups and /site-visits use (lib/business-time.ts).
function todayIso(): string {
  return businessDate();
}

// Pending follow-ups only, split into overdue / due-today by buildDutyItems.
// Excludes rows whose lead is missing or already closed (Won/Lost/Invalid)
// -- a closed lead should never generate a duty item, even if a stale
// follow-up row exists against it.
async function getPendingFollowUpsWithLead(): Promise<DutyFollowUpWithLead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("id, lead_id, type, due_date, due_time, notes, lead:leads(customer_name, phone, status, assigned:profiles(display_name))")
    .eq("status", "pending")
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DutyFollowUpWithLead[]).filter(
    (f) => f.lead && OPEN_LEAD_STATUSES.includes(f.lead.status),
  );
}

// The set of lead ids that currently have at least one pending follow-up --
// computed once and reused by both the "uncontacted" and "no follow-up
// elsewhere" checks below, rather than querying follow_ups twice.
async function getLeadIdsWithPendingFollowUp(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("follow_ups").select("lead_id").eq("status", "pending");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((f) => f.lead_id));
}

async function getOpenLeadsWithoutPendingFollowUp(statuses: LeadStatus[], excludeIds: Set<string>): Promise<DutyLeadWithoutFollowUp[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, phone, status, created_at, assigned:profiles(display_name)")
    .in("status", statuses)
    .is("merged_into_id", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DutyLeadWithoutFollowUp[]).filter((lead) => !excludeIds.has(lead.id));
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

  // The one canonical derivation (lib/duty.ts) -- already tier-sorted and
  // deduped to one winning DutyItem per lead. lib/today.ts consumes the
  // exact same function's output for /today; there is no second definition
  // of "needs attention" anywhere in the app.
  const dedupedItems = buildDutyItems({
    pendingFollowUps,
    unanswered,
    uncontactedLeads,
    noFollowUpLeads: noFollowUpElsewhere,
    today,
  });

  // Counts MUST be derived from dedupedItems, not the raw per-signal source
  // arrays (unanswered/uncontactedLeads/noFollowUpElsewhere) -- a lead that
  // trips two signals at once is shown once in the list (above), and a stat
  // tile built from the raw arrays would silently count it twice,
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

export type TodayFollowUpProgress = { done: number; pending: number; dueToday: number };

const EMPTY_TODAY_PROGRESS: TodayFollowUpProgress = { done: 0, pending: 0, dueToday: 0 };

// Real completion progress for follow-ups due today, scoped by the same RLS
// every other query in this file relies on (staff sees only their own rows).
// "target" for the Today's Progress ring is dueToday itself -- the actual
// count of tasks due today, not an invented fixed quota.
export async function getTodayFollowUpProgress(): Promise<TodayFollowUpProgress> {
  const profile = await getCurrentProfile();
  if (!profile) return EMPTY_TODAY_PROGRESS;

  const supabase = await createClient();
  const today = todayIso();

  const { data, error } = await supabase.from("follow_ups").select("status").eq("due_date", today);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const done = rows.filter((row) => row.status === "completed").length;
  return { done, pending: rows.length - done, dueToday: rows.length };
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
  service_required: string | null;
  location: string | null;
  created_at: string;
};

// Lightweight "what's coming in" list for the Admin dashboard's Recent
// Activity section -- the most recently created leads, regardless of
// source or assignment. Not a general activity feed (no new table for
// that in this phase); just the one recent-activity signal that's cheap
// and meaningful with existing columns. service_required/location are
// real lead columns (same ones the Leads list/cards already show) --
// included here so the reference's "Interior Work · Kochi" subtitle style
// is real data, not invented.
export async function getRecentLeads(limit = 5): Promise<RecentLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, phone, status, source, service_required, location, created_at")
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

export type LeadsTrendPoint = {
  date: string; // "YYYY-MM-DD" business day
  new: number;
  contacted: number;
  qualified: number;
  quotation: number;
  won: number;
};

// Daily counts of leads *created* on each of the last `days` business-days,
// broken down by their CURRENT status -- not a status-history
// reconstruction (no audit-log-based "reached this stage on this date"
// query in this phase; leads.status only ever holds the current stage).
// Matches the Admin Dashboard reference's 5-series trend chart legend
// (New/Contacted/Qualified/Quotation/Won); Site Visit/Negotiation/Lost are
// real statuses too but aren't in that legend, so they're left out here
// rather than silently added.
export async function getLeadsTrend(days = 7): Promise<LeadsTrendPoint[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const from = businessDatePlusDays(-(days - 1));
  const today = businessDate();
  const bounds = businessDayRangeToUtcBounds(from, today);

  let query = supabase.from("leads").select("created_at, status").is("merged_into_id", null);
  if (bounds) query = query.gte("created_at", bounds.startIso).lt("created_at", bounds.endExclusiveIso);
  if (profile.role === "staff") query = query.eq("assigned_to_id", profile.id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byDay = new Map<string, LeadsTrendPoint>();
  for (let i = 0; i < days; i += 1) {
    const date = businessDatePlusDays(-(days - 1 - i));
    byDay.set(date, { date, new: 0, contacted: 0, qualified: 0, quotation: 0, won: 0 });
  }

  for (const row of data ?? []) {
    const day = businessDateOf(row.created_at);
    const point = day ? byDay.get(day) : undefined;
    if (!point) continue;
    if (row.status === "new" || row.status === "contacted" || row.status === "qualified" || row.status === "quotation" || row.status === "won") {
      point[row.status] += 1;
    }
  }

  return Array.from(byDay.values());
}

export type RevenueOverviewPoint = {
  month: string; // "YYYY-MM"
  quotationValue: number;
  wonValue: number;
};

// Last `months` business-months of quotation/won value, bucketed by
// updated_at -- the same "quoted/won this month" approximation
// getStaffOverview() already documents and uses (no dedicated "quoted at" /
// "won at" timestamp exists in schema), applied across a range instead of
// just the current month.
export async function getRevenueOverview(months = 6): Promise<RevenueOverviewPoint[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("status, job_value, quotation_amount, updated_at")
    .is("merged_into_id", null);
  if (profile.role === "staff") query = query.eq("assigned_to_id", profile.id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const ranges = Array.from({ length: months }, (_, i) => businessMonthRange(months - 1 - i));
  return ranges.map(({ from, to }) => {
    const month = from.slice(0, 7);
    let quotationValue = 0;
    let wonValue = 0;
    for (const row of rows) {
      const day = businessDateOf(row.updated_at);
      if (!day || day < from || day > to) continue;
      if (row.quotation_amount !== null) quotationValue += row.quotation_amount;
      if (row.status === "won") wonValue += row.job_value ?? row.quotation_amount ?? 0;
    }
    return { month, quotationValue, wonValue };
  });
}

export type LeadSourceSlice = { source: string; label: string; count: number; percentage: number };

// Real lead.source values only (whatsapp/manual/meta_ads today -- see
// lib/constants.ts's LEAD_SOURCES for the full recognised set) -- never the
// generic Website/Instagram/Reference categories a generic dashboard
// reference might show, since this project doesn't track those.
export async function getLeadSourceDistribution(): Promise<LeadSourceSlice[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase.from("leads").select("source").is("merged_into_id", null);
  if (profile.role === "staff") query = query.eq("assigned_to_id", profile.id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const total = rows.length;
  if (total === 0) return [];

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.source ?? "other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({
      source,
      label: LEAD_SOURCE_LABELS[source] ?? source,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

export type TeamPerformanceRow = {
  staffId: string;
  displayName: string | null;
  totalLeads: number;
  siteVisits: number;
  won: number;
  conversionPct: number;
};

// Admin-only in practice, same as getStaffWorkload -- lifetime (not just
// open) counts per staff: leads ever assigned, how many had a site visit
// scheduled, how many were won, and won/total as a real conversion rate
// (0 when a staff member has no leads yet, never NaN/Infinity).
export async function getTeamPerformance(): Promise<TeamPerformanceRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const [{ data: profiles, error: profilesError }, { data: leads, error: leadsError }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("role", "staff"),
    supabase.from("leads").select("assigned_to_id, status, site_visit_date").is("merged_into_id", null),
  ]);
  if (profilesError) throw new Error(profilesError.message);
  if (leadsError) throw new Error(leadsError.message);

  return (profiles ?? [])
    .map((p) => {
      const own = (leads ?? []).filter((l) => l.assigned_to_id === p.id);
      const won = own.filter((l) => l.status === "won").length;
      const siteVisits = own.filter((l) => l.site_visit_date !== null).length;
      const totalLeads = own.length;
      return {
        staffId: p.id,
        displayName: p.display_name,
        totalLeads,
        siteVisits,
        won,
        conversionPct: totalLeads === 0 ? 0 : Math.round((won / totalLeads) * 1000) / 10,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

export type ScheduleItem = {
  key: string;
  time: string | null; // "HH:MM" or null when no time was recorded
  kind: "follow_up" | "site_visit";
  leadId: string;
  customerName: string | null;
  label: string;
};

const FOLLOW_UP_TYPE_LABEL: Record<FollowUpType, string> = {
  call: "Call",
  whatsapp_message: "WhatsApp message",
  site_visit: "Site visit",
  quotation: "Quotation",
  meeting: "Meeting",
  follow_up: "Follow-up",
};

// Today's schedule: pending follow-ups due today + leads with a site visit
// today, merged into one time-ordered list (real due_time / site_visit_date
// values only; an item with no recorded time sorts after every timed item,
// not to a fabricated time).
export async function getTodaysSchedule(): Promise<ScheduleItem[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const today = todayIso();

  const { data: followUps, error: followUpsError } = await supabase
    .from("follow_ups")
    .select("id, lead_id, type, due_time, lead:leads(customer_name, assigned_to_id)")
    .eq("status", "pending")
    .eq("due_date", today);
  if (followUpsError) throw new Error(followUpsError.message);

  const { data: siteLeads, error: siteLeadsError } = await supabase
    .from("leads")
    .select("id, customer_name, site_visit_date, assigned_to_id")
    .is("merged_into_id", null)
    .not("site_visit_date", "is", null);
  if (siteLeadsError) throw new Error(siteLeadsError.message);

  const isMine = (assignedToId: string | null) => profile.role === "admin" || assignedToId === profile.id;

  const followUpItems: ScheduleItem[] = ((followUps ?? []) as unknown as {
    id: string;
    lead_id: string;
    type: FollowUpType;
    due_time: string | null;
    lead: { customer_name: string | null; assigned_to_id: string | null } | null;
  }[])
    .filter((f) => isMine(f.lead?.assigned_to_id ?? null))
    .map((f) => ({
      key: `follow_up:${f.id}`,
      time: f.due_time ? f.due_time.slice(0, 5) : null,
      kind: "follow_up" as const,
      leadId: f.lead_id,
      customerName: f.lead?.customer_name ?? null,
      label: FOLLOW_UP_TYPE_LABEL[f.type],
    }));

  const siteVisitItems: ScheduleItem[] = ((siteLeads ?? []) as unknown as {
    id: string;
    customer_name: string | null;
    site_visit_date: string;
    assigned_to_id: string | null;
  }[])
    .filter((l) => businessDateOf(l.site_visit_date) === today && isMine(l.assigned_to_id))
    .map((l) => ({
      key: `site_visit:${l.id}`,
      time: toBusinessDateTimeLocal(l.site_visit_date).slice(11, 16) || null,
      kind: "site_visit" as const,
      leadId: l.id,
      customerName: l.customer_name,
      label: "Site visit",
    }));

  return [...followUpItems, ...siteVisitItems].sort((a, b) => {
    if (a.time === null) return b.time === null ? 0 : 1;
    if (b.time === null) return -1;
    return a.time.localeCompare(b.time);
  });
}
