import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FollowUpRow, FollowUpStatus, FollowUpType } from "@/lib/supabase/types";
import { FOLLOW_UP_TYPES } from "@/lib/constants";

export type UpcomingFollowUp = FollowUpRow & {
  lead: { customer_name: string | null } | null;
};

const UPCOMING_WINDOW_DAYS = 7;
const UPCOMING_LIMIT = 20;

// RLS (follow_ups_select_admin_or_owner) already restricts rows to leads
// the caller owns -- admin sees everything, staff only follow-ups on a
// lead assigned to them -- so no extra filtering is needed here, matching
// lib/conversations.ts.
export async function getFollowUpsForLead(leadId: string): Promise<FollowUpRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("lead_id", leadId)
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// Cross-lead, for the dashboard's "what needs attention today" list. Same
// RLS (follow_ups_select_admin_or_owner) as getFollowUpsForLead -- admin
// sees everything, staff only follow-ups on leads assigned to them -- no
// extra filtering needed. Overdue rows sort first because they have the
// earliest due_date, so a single ascending sort covers both "overdue
// first" and "soonest due next" without a separate sort key.
export async function getUpcomingFollowUps(): Promise<UpcomingFollowUp[]> {
  const supabase = await createClient();

  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + UPCOMING_WINDOW_DAYS);
  const windowEndDate = windowEnd.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("follow_ups")
    .select("*, lead:leads(customer_name)")
    .eq("status", "pending")
    .lte("due_date", windowEndDate)
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false })
    .limit(UPCOMING_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UpcomingFollowUp[];
}

export type FollowUpListItem = FollowUpRow & {
  lead: { customer_name: string | null } | null;
  assigned: { display_name: string | null } | null;
};

export type FollowUpStatusFilter = FollowUpStatus | "all";

export type FollowUpFilters = {
  status?: string;
  type?: string;
  assignedTo?: string;
};

function isFollowUpType(value: string): value is FollowUpType {
  return (FOLLOW_UP_TYPES as string[]).includes(value);
}

function isFollowUpStatusFilter(value: string): value is FollowUpStatusFilter {
  return value === "pending" || value === "completed" || value === "all";
}

// The Follow-ups workspace's own query -- unlike getUpcomingFollowUps() (the
// dashboard's narrow "next 7 days, pending only" widget), this returns every
// row the caller's RLS allows, so the workspace can group overdue/today/
// upcoming/completed itself and apply real filters. Same RLS
// (follow_ups_select_admin_or_owner) as every other function here -- admin
// sees everything, staff only follow-ups on leads assigned to them -- so an
// assignedTo value naming another user only ever narrows a staff caller's
// own already-RLS-scoped rows to nothing, it can never widen access.
export async function getFollowUps(filters: FollowUpFilters): Promise<FollowUpListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("follow_ups")
    .select("*, lead:leads(customer_name), assigned:profiles(display_name)")
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false });

  const status = filters.status ?? "";
  if (status && isFollowUpStatusFilter(status) && status !== "all") {
    query = query.eq("status", status);
  }
  if (filters.type && isFollowUpType(filters.type)) {
    query = query.eq("type", filters.type);
  }
  if (filters.assignedTo) {
    query = query.eq("assigned_to_id", filters.assignedTo);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FollowUpListItem[];
}
