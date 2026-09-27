import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database, LeadRow, LeadStatus } from "@/lib/supabase/types";
import { LEAD_STATUSES, OPEN_LEAD_STATUSES } from "@/lib/constants";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { businessDate, businessDateOf, businessDayRangeToUtcBounds } from "@/lib/business-time";
import { isDatePreset, resolveDateRange } from "@/lib/lead-date-filters";

export { DATE_PRESETS, isDatePreset, resolveDateRange, type DatePreset } from "@/lib/lead-date-filters";

function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as string[]).includes(value);
}

export type LeadFilters = {
  search?: string;
  status?: string;
  campaign?: string;
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
};

function sanitizeForFilter(value: string) {
  // Strip characters meaningful to PostgREST's filter mini-language so a
  // search term can't inject extra filter clauses.
  return value.replace(/[,()]/g, "").trim();
}

// RLS on leads is still permissive (Phase 3B has not replaced it yet), so
// every read here enforces ownership explicitly in application code rather
// than relying on the database. Staff sees only assigned_to_id = their own
// id; admin is unrestricted. A missing profile fails closed to no access.

export type LeadListRow = LeadRow & { assigned: { display_name: string | null } | null };

// Shared by getLeads() and getLeadIdsInListOrder() -- the exact same
// filter/scope/order logic applied to whatever `select` clause the caller
// needs, so the "Save & Next" resolver can never drift from what the Leads
// list itself actually renders. One source of truth for ordering.
function buildLeadsQuery(
  supabase: SupabaseClient<Database>,
  profile: CurrentProfile,
  filters: LeadFilters,
  select: string
) {
  let query = supabase
    .from("leads")
    .select(select)
    .is("merged_into_id", null)
    .order("created_at", { ascending: false });

  if (profile.role === "staff") {
    query = query.eq("assigned_to_id", profile.id);
  }

  const search = filters.search ? sanitizeForFilter(filters.search) : "";
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  if (filters.status && isLeadStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters.campaign) {
    query = query.eq("campaign_name", filters.campaign);
  }

  const dateRange = resolveDateRange(filters);
  if (dateRange) {
    const bounds = businessDayRangeToUtcBounds(dateRange.from, dateRange.to);
    if (bounds) {
      query = query.gte("created_at", bounds.startIso).lt("created_at", bounds.endExclusiveIso);
    }
  }

  return query;
}

// Same assigned:profiles(display_name) embed as getUncontactedLeads() below --
// existing, already-proven pattern, not a new query shape. Needed so the
// leads list can show ownership without an N+1 lookup per row.
export async function getLeads(filters: LeadFilters): Promise<LeadListRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await buildLeadsQuery(supabase, profile, filters, "*, assigned:profiles(display_name)");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadListRow[];
}

// The ordered id sequence the Leads list would render for these exact
// filters -- id-only, so it's cheap to run purely to locate "the next lead"
// (Lead Detail's Save & Next). Reuses buildLeadsQuery so this can never
// disagree with getLeads()'s own ordering/scoping/filtering.
export async function getLeadIdsInListOrder(filters: LeadFilters): Promise<string[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await buildLeadsQuery(supabase, profile, filters, "id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as { id: string }[]).map((row) => row.id);
}

// The Leads-list query params, reduced to only the ones actually set --
// shared by every place that needs to carry "which filtered/sorted list was
// this lead opened from" through a URL (list -> detail -> edit -> the Save &
// Next redirect target), so that context round-trips via plain query-string
// state rather than a new client-side store.
export function buildLeadsQueryString(filters: LeadFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.campaign) params.set("campaign", filters.campaign);
  if (filters.datePreset && isDatePreset(filters.datePreset)) {
    params.set("datePreset", filters.datePreset);
    if (filters.datePreset === "custom") {
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
    }
  }
  return params.toString();
}

export async function getCampaignOptions(): Promise<string[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase.from("leads").select("campaign_name").not("campaign_name", "is", null);

  if (profile.role === "staff") {
    query = query.eq("assigned_to_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const unique = new Set((data ?? []).map((row) => row.campaign_name as string));
  return Array.from(unique).sort();
}

export type DashboardStats = {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  siteVisits: number;
  quotations: number;
  wonJobs: number;
  lostLeads: number;
  revenue: number;
  // Full per-status tally for the pipeline visualization -- computed from
  // the same rows already fetched below (no extra Supabase query). Covers
  // every LeadStatus, including the ones the named fields above don't
  // (contacted, negotiation, invalid), so the dashboard's status breakdown
  // never silently drops leads that are in one of those stages.
  statusBreakdown: Record<LeadStatus, number>;
};

const EMPTY_STATUS_BREAKDOWN: Record<LeadStatus, number> = Object.fromEntries(
  LEAD_STATUSES.map((status) => [status, 0]),
) as Record<LeadStatus, number>;

const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalLeads: 0,
  newLeads: 0,
  qualifiedLeads: 0,
  siteVisits: 0,
  quotations: 0,
  wonJobs: 0,
  lostLeads: 0,
  revenue: 0,
  statusBreakdown: EMPTY_STATUS_BREAKDOWN,
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const profile = await getCurrentProfile();
  if (!profile) return EMPTY_DASHBOARD_STATS;

  const supabase = await createClient();
  let query = supabase.from("leads").select("status, job_value");

  if (profile.role === "staff") {
    query = query.eq("assigned_to_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const count = (status: LeadStatus) => rows.filter((row) => row.status === status).length;
  const statusBreakdown = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, count(status)]),
  ) as Record<LeadStatus, number>;

  return {
    totalLeads: rows.length,
    newLeads: count("new"),
    qualifiedLeads: count("qualified"),
    siteVisits: count("site_visit"),
    quotations: count("quotation"),
    wonJobs: count("won"),
    lostLeads: count("lost"),
    revenue: rows
      .filter((row) => row.status === "won")
      .reduce((sum, row) => sum + (row.job_value ?? 0), 0),
    statusBreakdown,
  };
}

export type StaffOverview = {
  // Sum of active (open-pipeline) leads' job_value, falling back to
  // quotation_amount when no job_value has been set yet -- the same
  // "best known deal size" fallback the Deals UI-level view already uses.
  pipelineValue: number;
  totalLeadsThisMonth: number;
  siteVisitsThisMonth: number;
  // No dedicated "quotation sent" / "won at" timestamp exists in schema yet
  // (see .claude/rules/database.md -- UI-level view over existing columns
  // only, no new schema without approval), so these two are approximated by
  // "last updated this month" on a lead that already has the relevant field
  // set. Good enough for a dashboard stat tile; not audit-grade.
  quotationsThisMonth: number;
  wonThisMonth: number;
};

const EMPTY_STAFF_OVERVIEW: StaffOverview = {
  pipelineValue: 0,
  totalLeadsThisMonth: 0,
  siteVisitsThisMonth: 0,
  quotationsThisMonth: 0,
  wonThisMonth: 0,
};

export async function getStaffOverview(): Promise<StaffOverview> {
  const profile = await getCurrentProfile();
  if (!profile) return EMPTY_STAFF_OVERVIEW;

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("status, job_value, quotation_amount, site_visit_date, created_at, updated_at")
    .is("merged_into_id", null);

  if (profile.role === "staff") {
    query = query.eq("assigned_to_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const monthKey = businessDate().slice(0, 7);
  const inThisMonth = (value: string | null) => value !== null && businessDateOf(value)?.slice(0, 7) === monthKey;

  const pipelineValue = rows
    .filter((row) => OPEN_LEAD_STATUSES.includes(row.status))
    .reduce((sum, row) => sum + (row.job_value ?? row.quotation_amount ?? 0), 0);

  return {
    pipelineValue,
    totalLeadsThisMonth: rows.filter((row) => inThisMonth(row.created_at)).length,
    siteVisitsThisMonth: rows.filter((row) => inThisMonth(row.site_visit_date)).length,
    quotationsThisMonth: rows.filter((row) => row.quotation_amount !== null && inThisMonth(row.updated_at)).length,
    wonThisMonth: rows.filter((row) => row.status === "won" && inThisMonth(row.updated_at)).length,
  };
}

export type UncontactedLead = LeadRow & { assigned: { display_name: string | null } | null };

// "Not contacted" = status is still "new", the pipeline's own first stage
// (LEAD_STATUSES / setLeadStatus already model contact as the new->contacted
// transition) -- not a separately invented signal. Same staff filter as the
// rest of this file, defense-in-depth alongside leads_select_admin_or_owner.
// Excludes retired/merged leads (merged_into_id set) -- same "active leads
// only" convention as every other query in this file; a merged lead is a
// dead record and must never surface as needing first contact.
export async function getUncontactedLeads(): Promise<UncontactedLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("*, assigned:profiles(display_name)")
    .eq("status", "new")
    .is("merged_into_id", null)
    .order("created_at", { ascending: true });

  if (profile.role === "staff") {
    query = query.eq("assigned_to_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UncontactedLead[];
}

export const getLeadById = cache(async (id: string): Promise<LeadRow | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
  if (error || !data) return null;

  if (profile.role === "staff" && data.assigned_to_id !== profile.id) {
    return null;
  }

  await recordAuditEvent({
    actorId: profile.id,
    action: "lead_viewed",
    targetType: "lead",
    targetId: data.id,
  });

  return data;
});
