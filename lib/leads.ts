import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LeadRow, LeadStatus } from "@/lib/supabase/types";
import { LEAD_STATUSES } from "@/lib/constants";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as string[]).includes(value);
}

export type LeadFilters = {
  search?: string;
  status?: string;
  campaign?: string;
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

// Same assigned:profiles(display_name) embed as getUncontactedLeads() below --
// existing, already-proven pattern, not a new query shape. Needed so the
// leads list can show ownership without an N+1 lookup per row.
export async function getLeads(filters: LeadFilters): Promise<LeadListRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*, assigned:profiles(display_name)")
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

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeadListRow[];
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

export type UncontactedLead = LeadRow & { assigned: { display_name: string | null } | null };

// "Not contacted" = status is still "new", the pipeline's own first stage
// (LEAD_STATUSES / setLeadStatus already model contact as the new->contacted
// transition) -- not a separately invented signal. Same staff filter as the
// rest of this file, defense-in-depth alongside leads_select_admin_or_owner.
export async function getUncontactedLeads(): Promise<UncontactedLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("*, assigned:profiles(display_name)")
    .eq("status", "new")
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
