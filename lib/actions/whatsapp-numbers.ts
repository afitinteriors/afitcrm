"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import type { WhatsAppNumberPurpose, WhatsAppNumberRow, WhatsAppNumberStatus } from "@/lib/supabase/types";

// Admin-only for every mutation here -- whatsapp_numbers RLS
// (whatsapp_numbers_admin_only) already enforces this independently; this
// is the same explicit application-level check used throughout this app
// (e.g. automation-config.ts's requireAdmin()), not a substitute for it.
async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

function revalidateWhatsAppNumbersPage() {
  revalidatePath("/settings/whatsapp-numbers");
}

export type WhatsAppNumber = {
  id: string;
  label: string;
  phoneNumber: string;
  status: WhatsAppNumberStatus;
  purpose: WhatsAppNumberPurpose;
  assignedStaffIds: string[];
  isDefault: boolean;
};

function toWhatsAppNumber(row: WhatsAppNumberRow): WhatsAppNumber {
  return {
    id: row.id,
    label: row.label,
    phoneNumber: row.phone_number,
    status: row.status,
    purpose: row.purpose,
    assignedStaffIds: row.assigned_staff_ids,
    isDefault: row.is_default,
  };
}

// Admin-only in practice -- the query mirrors whatsapp_numbers RLS (admin
// sees all, everyone else sees nothing); returns [] for a non-admin caller
// explicitly rather than relying on the database to come back empty, same
// convention as getAssignableStaff()/getUnassignedLeads().
export async function getWhatsAppNumbers(): Promise<WhatsAppNumber[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase.from("whatsapp_numbers").select("*").order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map(toWhatsAppNumber);
}

export type SaveNumberInput = {
  id: string | null; // null = create
  label: string;
  phoneNumber: string;
  purpose: WhatsAppNumberPurpose;
  assignedStaffIds: string[];
  isDefault: boolean;
};

export type SaveNumberResult = { ok: true; number: WhatsAppNumber } | { error: string };

// Single entry point for both "Add WhatsApp Number" and "Manage" (edit) --
// matches NumberFormModal's own single onSave(number) callback shape, so
// the form component needed no change to call a real backend instead of
// local state.
export async function saveWhatsAppNumber(input: SaveNumberInput): Promise<SaveNumberResult> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admin access required." };

  const label = input.label.trim();
  const phoneNumber = input.phoneNumber.trim();
  if (!label) return { error: "Give this number a name." };
  if (!phoneNumber) return { error: "Enter a phone number." };

  const supabase = await createClient();

  // Setting this number as default must clear every other row's
  // is_default first -- whatsapp_numbers_one_default_idx (a partial unique
  // index) rejects two rows with is_default=true at once, so the clear and
  // the set are two statements, in that order, not a single upsert.
  if (input.isDefault) {
    const { error: clearError } = await supabase.from("whatsapp_numbers").update({ is_default: false }).eq("is_default", true);
    if (clearError) return { error: "Could not update the default number." };
  }

  const payload = {
    label,
    phone_number: phoneNumber,
    purpose: input.purpose,
    assigned_staff_ids: input.assignedStaffIds,
    is_default: input.isDefault,
  };

  const { data, error } = input.id
    ? await supabase.from("whatsapp_numbers").update(payload).eq("id", input.id).select("*").maybeSingle()
    : await supabase.from("whatsapp_numbers").insert(payload).select("*").maybeSingle();

  if (error || !data) return { error: "Could not save this WhatsApp number." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "setting_changed",
    targetType: "setting",
    targetId: data.id,
    metadata: { field: "whatsapp_number", created: !input.id },
  });

  revalidateWhatsAppNumbersPage();
  return { ok: true, number: toWhatsAppNumber(data) };
}

export type SetDefaultResult = { ok: true } | { error: string };

export async function setDefaultWhatsAppNumber(id: string): Promise<SetDefaultResult> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admin access required." };
  if (!id) return { error: "Missing number." };

  const supabase = await createClient();

  const { error: clearError } = await supabase.from("whatsapp_numbers").update({ is_default: false }).eq("is_default", true);
  if (clearError) return { error: "Could not update the default number." };

  const { error: setError } = await supabase.from("whatsapp_numbers").update({ is_default: true }).eq("id", id);
  if (setError) return { error: "Could not set this number as default." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "setting_changed",
    targetType: "setting",
    targetId: id,
    metadata: { field: "is_default" },
  });

  revalidateWhatsAppNumbersPage();
  return { ok: true };
}
