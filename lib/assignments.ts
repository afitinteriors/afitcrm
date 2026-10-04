import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";
import {
  buildStaffWorkload,
  describeAssignmentEvent,
  sortUnassignedOldestFirst,
  summarizeUnassigned,
  type AssignmentHistoryEntry,
  type StaffWorkloadItem,
  type UnassignedSummary,
} from "@/lib/assignment-logic";
import type { LeadStatus } from "@/lib/supabase/types";

export type UnassignedLeadRow = {
  id: string;
  customer_name: string;
  source: string | null;
  status: LeadStatus;
  created_at: string;
  location: string | null;
  project_type: string | null;
  service_required: string | null;
  job_value: number | null;
  quotation_amount: number | null;
};

// Admin-only. The query mirrors the leads RLS (admin sees all); the explicit
// role check returns [] for everyone else rather than relying on the database
// to come back empty.
export async function getUnassignedLeads(): Promise<UnassignedLeadRow[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, customer_name, source, status, created_at, location, project_type, service_required, job_value, quotation_amount")
    .is("assigned_to_id", null)
    .in("status", OPEN_LEAD_STATUSES)
    .is("merged_into_id", null)
    .order("created_at", { ascending: true });

  if (error) return [];
  return sortUnassignedOldestFirst((data ?? []) as UnassignedLeadRow[]);
}

export async function getUnassignedSummary(now: Date = new Date()): Promise<UnassignedSummary> {
  const rows = await getUnassignedLeads();
  return summarizeUnassigned(rows, now);
}

// Real open-lead counts per staff member (same OPEN_LEAD_STATUSES the
// dashboards use). No capacity is configured anywhere, so none is returned.
export async function getStaffWorkload(): Promise<StaffWorkloadItem[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();
  const [{ data: staff }, { data: open }] = await Promise.all([
    supabase.from("profiles").select("id, display_name").eq("role", "staff"),
    supabase
      .from("leads")
      .select("assigned_to_id")
      .in("status", OPEN_LEAD_STATUSES)
      .is("merged_into_id", null)
      .not("assigned_to_id", "is", null),
  ]);

  return buildStaffWorkload(staff ?? [], open ?? []);
}

// Assignment history for one lead, read from audit_logs (the existing audit
// table; the admin-only select policy applies). Oldest first. Nothing here
// writes or rewrites history.
export async function getLeadAssignmentHistory(leadId: string): Promise<AssignmentHistoryEntry[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("audit_logs")
    .select("actor_id, action, metadata, created_at")
    .eq("target_type", "lead")
    .eq("target_id", leadId)
    .eq("action", "lead_assigned")
    .order("created_at", { ascending: true });

  const rows = (events ?? []) as {
    actor_id: string | null;
    action: string;
    metadata: { previous_staff_id?: string | null; new_staff_id?: string | null } | null;
    created_at: string;
  }[];

  const ids = new Set<string>();
  for (const e of rows) {
    if (e.actor_id) ids.add(e.actor_id);
    if (e.metadata?.previous_staff_id) ids.add(e.metadata.previous_staff_id);
    if (e.metadata?.new_staff_id) ids.add(e.metadata.new_staff_id);
  }
  const names = new Map<string, string>();
  if (ids.size > 0) {
    const { data: people } = await supabase.from("profiles").select("id, display_name").in("id", [...ids]);
    for (const p of people ?? []) names.set(p.id, p.display_name || "Unnamed");
  }

  return rows.map((e) =>
    describeAssignmentEvent(
      { created_at: e.created_at, actorName: (e.actor_id && names.get(e.actor_id)) || "Someone", metadata: e.metadata },
      names,
    ),
  );
}
