import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LeadRow, LeadStatus } from "@/lib/supabase/types";
import { LEAD_STATUSES } from "@/lib/constants";
import { businessDayRangeToUtcBounds } from "@/lib/business-time";
import { resolveDateRange, type DateFilterInput } from "@/lib/lead-date-filters";
import { privacySafeLeadReference } from "@/lib/hermes/agent-events";

// Safety cap for this endpoint's response size -- deliberately smaller than
// UNPAGINATED_LIST_QUERY_LIMIT (lib/constants.ts's 1000, the Leads list's
// own cap): Hermes asks a narrow question ("Kollam leads this week?"), not
// for the whole table, and a smaller cap keeps a single response reasonable
// to summarize back to the owner on Telegram.
const HERMES_QUERY_LIMIT = 200;

export type HermesLeadFilters = DateFilterInput & {
  status?: string;
  location?: string;
  assignedToId?: string;
};

export type HermesLeadSummary = {
  reference: string; // privacy-safe, see privacySafeLeadReference -- no phone/name
  crmUrl: string;
  status: LeadStatus;
  assignedToId: string | null;
  createdAt: string;
};

function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as string[]).includes(value);
}

// Blueprint V1 Section 9, Phase 5: backs the "Read leads, deals" tool and
// the "Ask anything" job (e.g. "Kollam leads this week?"). Reuses
// lib/lead-date-filters.ts's pure preset resolution (the exact same date
// logic the Leads list UI uses), but is otherwise a fresh query -- not
// lib/leads.ts's getLeads(), which is scoped to the logged-in user via
// getCurrentProfile() and selects customer_name/phone that must never
// reach Hermes. Selecting only privacy-safe columns here is the whole
// point, same reasoning as lib/hermes/attention.ts.
export async function queryLeads(supabase: SupabaseClient<Database>, filters: HermesLeadFilters): Promise<HermesLeadSummary[]> {
  let query = supabase
    .from("leads")
    .select("id, location, service_required, project_type, assigned_to_id, status, created_at")
    .is("merged_into_id", null)
    .order("created_at", { ascending: false })
    .limit(HERMES_QUERY_LIMIT);

  if (filters.status && isLeadStatus(filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters.location) {
    query = query.ilike("location", `%${filters.location.replace(/[%_,()]/g, "")}%`);
  }
  if (filters.assignedToId) {
    query = query.eq("assigned_to_id", filters.assignedToId);
  }

  const dateRange = resolveDateRange(filters);
  if (dateRange) {
    const bounds = businessDayRangeToUtcBounds(dateRange.from, dateRange.to);
    if (bounds) {
      query = query.gte("created_at", bounds.startIso).lt("created_at", bounds.endExclusiveIso);
    }
  }

  const { data } = await query;
  type Row = Pick<LeadRow, "id" | "location" | "service_required" | "project_type" | "assigned_to_id" | "status" | "created_at">;
  return ((data ?? []) as Row[]).map((lead) => ({
    reference: privacySafeLeadReference(lead),
    crmUrl: `/leads/${lead.id}`,
    status: lead.status,
    assignedToId: lead.assigned_to_id,
    createdAt: lead.created_at,
  }));
}
