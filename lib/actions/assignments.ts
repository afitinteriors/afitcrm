"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit";
import { MAX_BULK_ASSIGN } from "@/lib/assignment-logic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BulkAssignResult = { error: string } | { assigned: number; skipped: number };

// Assigns several UNASSIGNED leads to one staff member. Admin-only (checked
// here, server-side). Only the assigned_to_id field is written, and only for
// leads that are still unassigned at write time -- a lead someone else
// assigned in the meantime is counted as skipped, never overwritten. Each
// assignment gets its own audit event, so history stays per lead.
export async function bulkAssignUnassignedLeads(leadIds: string[], staffId: string): Promise<BulkAssignResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.role !== "admin") return { error: "Only an admin can assign leads." };

  const ids = [...new Set(leadIds)];
  if (ids.length === 0) return { error: "Select at least one lead." };
  if (ids.length > MAX_BULK_ASSIGN) return { error: `Select at most ${MAX_BULK_ASSIGN} leads at once.` };
  if (!ids.every((id) => UUID.test(id))) return { error: "Invalid lead selection." };
  if (!UUID.test(staffId)) return { error: "Select a valid staff member." };

  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id").eq("id", staffId).eq("role", "staff").single();
  if (!target) return { error: "Select a valid staff member." };

  const { data: updated, error } = await supabase
    .from("leads")
    .update({ assigned_to_id: staffId })
    .in("id", ids)
    .is("assigned_to_id", null)
    .is("merged_into_id", null)
    .select("id");

  if (error) return { error: "Could not assign the selected leads." };

  const assignedIds = (updated ?? []).map((row) => row.id);
  await Promise.all(
    assignedIds.map((id) =>
      recordAuditEvent({
        actorId: profile.id,
        action: "lead_assigned",
        targetType: "lead",
        targetId: id,
        metadata: { previous_staff_id: null, new_staff_id: staffId, bulk: true, bulk_size: ids.length },
      }),
    ),
  );

  revalidatePath("/leads");
  revalidatePath("/leads/unassigned");
  revalidatePath("/dashboard");
  return { assigned: assignedIds.length, skipped: ids.length - assignedIds.length };
}
