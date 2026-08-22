import { createClient } from "@/lib/supabase/server";
import type { FollowUpRow } from "@/lib/supabase/types";

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

// Overdue is derived, not stored, so it can never drift out of sync with
// due_date/status.
export function isFollowUpOverdue(followUp: Pick<FollowUpRow, "status" | "due_date">): boolean {
  if (followUp.status !== "pending") return false;
  const today = new Date().toISOString().slice(0, 10);
  return followUp.due_date < today;
}
