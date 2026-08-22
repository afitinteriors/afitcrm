import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FollowUpRow } from "@/lib/supabase/types";

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
