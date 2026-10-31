import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { QuotationRow } from "@/lib/supabase/types";

// RLS (quotations_select_admin_or_owner) already restricts rows to leads
// the caller owns -- admin sees everything, staff only quotations on a
// lead assigned to them -- so no extra filtering is needed here, matching
// lib/follow-ups.ts's getFollowUpsForLead. Newest version first, so the
// caller can take [0] as "current" without a separate query.
export async function getQuotationsForLead(leadId: string): Promise<QuotationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotations")
    .select("*")
    .eq("lead_id", leadId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
