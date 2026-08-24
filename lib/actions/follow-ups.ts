"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import type { FollowUpType } from "@/lib/supabase/types";

export type ActionState = { error: string } | null;

const FOLLOW_UP_TYPES: FollowUpType[] = [
  "call",
  "whatsapp_message",
  "site_visit",
  "quotation",
  "meeting",
  "follow_up",
];

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isFollowUpType(value: string): value is FollowUpType {
  return (FOLLOW_UP_TYPES as string[]).includes(value);
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function isValidTime(value: string): boolean {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value);
}

// Authorization is not duplicated here -- follow_ups_insert_admin_or_owner
// (RLS) already restricts inserts to leads the caller owns, admin
// unrestricted, mirroring messages_insert_admin_or_owner. A staff attempt
// against another user's lead is rejected by the database, not just hidden
// in the UI.
export async function createFollowUp(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  if (!leadId) return { error: "Missing lead." };

  const typeInput = str(formData, "type");
  const type: FollowUpType = isFollowUpType(typeInput) ? typeInput : "follow_up";

  const dueDate = str(formData, "due_date");
  if (!dueDate || !isValidDate(dueDate)) return { error: "Pick a valid due date." };

  const dueTime = str(formData, "due_time");
  if (dueTime && !isValidTime(dueTime)) return { error: "Enter a valid due time." };

  const notes = str(formData, "notes");

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      lead_id: leadId,
      type,
      due_date: dueDate,
      due_time: dueTime || null,
      notes: notes || null,
      assigned_to_id: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Could not create follow-up. You may not have access to this lead." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "follow_up_created",
    targetType: "follow_up",
    targetId: data.id,
  });

  revalidatePath(`/leads/${leadId}`);
  return null;
}

// Same fail-closed pattern as above, via follow_ups_update_admin_or_owner.
// .select().maybeSingle() is required here (not just checking `error`)
// because an UPDATE blocked by RLS affects zero rows without raising an
// error -- only the returned row tells us whether it actually happened.
export async function completeFollowUp(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const followUpId = str(formData, "follow_up_id");
  const leadId = str(formData, "lead_id");
  if (!followUpId || !leadId) return { error: "Missing follow-up." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", followUpId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { error: "Could not update this follow-up. You may not have access to it." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "follow_up_completed",
    targetType: "follow_up",
    targetId: data.id,
  });

  revalidatePath(`/leads/${leadId}`);
  // Also revalidated so completing from the dashboard's cross-lead list
  // (B10) removes the item there too -- that page is a different route,
  // so the revalidatePath above alone doesn't cover it.
  revalidatePath("/dashboard");
  return null;
}
