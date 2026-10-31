"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import type { Database } from "@/lib/supabase/types";

export type ActionState = { error: string } | null;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateLead(leadId: string) {
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

// Same shape as lib/actions/leads.ts's own checkLeadAccess -- duplicated
// rather than imported, matching this codebase's existing convention of
// small per-file helpers (str/optionalStr/etc. are duplicated the same
// way across action files) over cross-file coupling for a few lines.
async function checkLeadAccess(supabase: SupabaseClient<Database>, leadId: string): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.role === "admin") return null;

  const { data: lead } = await supabase.from("leads").select("assigned_to_id").eq("id", leadId).single();
  if (!lead || lead.assigned_to_id !== profile.id) {
    return { error: "You do not have access to this lead." };
  }
  return null;
}

// R-QUOTE-001 (docs/BLUEPRINT_V1.md Section 8): "A sent quotation is never
// edited; a change creates a new version." A quotation starts as a DRAFT,
// freely editable in place -- iterating on a number before it's actually
// been shared with the customer doesn't need a new version every save.
// Once the latest version is SENT (locked), any further change creates
// version + 1 instead of touching the sent row. leads.quotation_amount is
// kept in sync as the denormalized "current amount" every existing reader
// (dashboard, reports, the Commercial card) already uses.
export async function saveQuotationDraft(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = str(formData, "lead_id");
  const amountRaw = str(formData, "amount");
  const amount = Number(amountRaw);
  if (!leadId) return { error: "Missing lead." };
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid quotation amount." };
  }
  const notes = str(formData, "notes") || null;

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const profile = await getCurrentProfile();

  const { data: latest } = await supabase
    .from("quotations")
    .select("id, version, status")
    .eq("lead_id", leadId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && latest.status === "draft") {
    const { error } = await supabase.from("quotations").update({ amount, notes }).eq("id", latest.id);
    if (error) return { error: error.message };
  } else {
    const nextVersion = (latest?.version ?? 0) + 1;
    const { error } = await supabase.from("quotations").insert({
      lead_id: leadId,
      version: nextVersion,
      amount,
      notes,
      created_by: profile?.id ?? null,
    });
    if (error) return { error: error.message };
  }

  const { error: syncError } = await supabase.from("leads").update({ quotation_amount: amount }).eq("id", leadId);
  revalidateLead(leadId);
  if (syncError) return { error: syncError.message };

  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: ["quotation_amount"] },
    });
  }

  return null;
}

// R-QUOTE-001: locks the given DRAFT quotation. Scoped to this exact
// (quotation_id, lead_id, status = 'draft') row -- matches zero rows (and
// is reported as an error, not a silent success) for an already-sent
// quotation, a quotation on a different lead, or one this caller's RLS
// doesn't grant access to, so this can never be used to "re-send" a
// locked row or touch one the caller doesn't own.
export async function sendQuotation(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const quotationId = str(formData, "quotation_id");
  const leadId = str(formData, "lead_id");
  if (!quotationId || !leadId) return { error: "Missing quotation." };

  const supabase = await createClient();
  const accessError = await checkLeadAccess(supabase, leadId);
  if (accessError) return accessError;

  const { data: updated, error } = await supabase
    .from("quotations")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", quotationId)
    .eq("lead_id", leadId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  revalidateLead(leadId);
  if (error) return { error: error.message };
  if (!updated) return { error: "This quotation could not be sent (it may already be sent)." };

  const profile = await getCurrentProfile();
  if (profile) {
    await recordAuditEvent({
      actorId: profile.id,
      action: "lead_updated",
      targetType: "lead",
      targetId: leadId,
      metadata: { fields_changed: ["quotation_status"] },
    });
  }

  return null;
}
