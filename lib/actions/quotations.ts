"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { sendDedupedAlert } from "@/lib/rules/alert";
import { discountPercent, needsDiscountApproval } from "@/lib/quotation-discount";
import { DISCOUNT_APPROVAL_LIMIT_PERCENT } from "@/lib/constants";
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

  let savedQuotationId: string;
  let savedVersion: number;

  if (latest && latest.status === "draft") {
    const { error } = await supabase.from("quotations").update({ amount, notes }).eq("id", latest.id);
    if (error) return { error: error.message };
    savedQuotationId = latest.id;
    savedVersion = latest.version;
  } else {
    const nextVersion = (latest?.version ?? 0) + 1;
    const { data: inserted, error } = await supabase
      .from("quotations")
      .insert({
        lead_id: leadId,
        version: nextVersion,
        amount,
        notes,
        created_by: profile?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !inserted) return { error: error?.message ?? "Could not save this quotation." };
    savedQuotationId = inserted.id;
    savedVersion = nextVersion;
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

  // R-QUOTE-002: version 1 has nothing to discount against (it IS the
  // baseline). From v2 onward, alert admins once this exact version is
  // known to carry a discount past the configured limit -- best-effort and
  // non-blocking, same reasoning as every other alert-on-write in this
  // codebase (R-FUP-002's missed-call template): the quotation save itself
  // has already succeeded above regardless of what happens here.
  if (savedVersion > 1) {
    try {
      await alertAdminsOfDiscountIfNeeded(supabase, leadId, savedQuotationId, amount);
    } catch (err) {
      console.error("Discount-approval alert failed unexpectedly:", err instanceof Error ? err.message : err);
    }
  }

  return null;
}

// R-QUOTE-002 (docs/BLUEPRINT_V1.md Section 8): discount is measured
// against this quotation's own version 1 (see lib/quotation-discount.ts
// and the migration's own comment for why). Returns 0 for version 1
// itself, or if v1 can't be found (shouldn't happen -- v1 always exists
// once any later version does).
async function getDiscountPercentForVersion(supabase: SupabaseClient<Database>, leadId: string, amount: number): Promise<number> {
  const { data: v1 } = await supabase.from("quotations").select("amount").eq("lead_id", leadId).eq("version", 1).maybeSingle();
  if (!v1) return 0;
  return discountPercent(v1.amount, amount);
}

async function alertAdminsOfDiscountIfNeeded(
  supabase: SupabaseClient<Database>,
  leadId: string,
  quotationId: string,
  amount: number,
): Promise<void> {
  const pct = await getDiscountPercentForVersion(supabase, leadId, amount);
  if (!needsDiscountApproval(pct, DISCOUNT_APPROVAL_LIMIT_PERCENT)) return;

  const admin = createAdminClient();
  const [{ data: lead }, { data: adminProfiles }] = await Promise.all([
    admin.from("leads").select("customer_name, phone").eq("id", leadId).maybeSingle(),
    admin.from("profiles").select("id").eq("role", "admin").eq("active", true),
  ]);

  const label = lead?.customer_name?.trim() || lead?.phone || "A lead";
  const roundedPct = Math.round(pct);

  await Promise.all(
    (adminProfiles ?? []).map((a) =>
      sendDedupedAlert(admin, {
        userId: a.id,
        entityId: leadId,
        dedupeKey: `quotation-discount:${quotationId}`,
        type: "quotation.discount_approval",
        title: "Discount needs approval",
        body: `${label}'s quotation is ${roundedPct}% below its original price.`,
        route: `/leads/${leadId}`,
      }),
    ),
  );
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

  // R-QUOTE-002: a discount past the limit blocks sending until an admin
  // approves it -- checked against THIS row's own saved amount/version
  // (not re-derived from the form), so the gate can't be bypassed by
  // submitting a stale/forged amount.
  const { data: quotation } = await supabase
    .from("quotations")
    .select("version, amount, discount_approved_at")
    .eq("id", quotationId)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (quotation && quotation.version > 1 && !quotation.discount_approved_at) {
    const pct = await getDiscountPercentForVersion(supabase, leadId, quotation.amount);
    if (needsDiscountApproval(pct, DISCOUNT_APPROVAL_LIMIT_PERCENT)) {
      return { error: `This quotation is ${Math.round(pct)}% below the original price (limit ${DISCOUNT_APPROVAL_LIMIT_PERCENT}%) and needs admin approval before it can be sent.` };
    }
  }

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

// R-QUOTE-002: admin-only -- the one action that clears the discount gate
// sendQuotation enforces above. Scoped to this exact row (never bulk,
// never by anything other than id+lead_id) so one approval can never be
// mistaken for another lead's.
export async function approveQuotationDiscount(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const quotationId = str(formData, "quotation_id");
  const leadId = str(formData, "lead_id");
  if (!quotationId || !leadId) return { error: "Missing quotation." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };
  if (profile.role !== "admin") return { error: "Only an admin can approve a discount." };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("quotations")
    .update({ discount_approved_by: profile.id, discount_approved_at: new Date().toISOString() })
    .eq("id", quotationId)
    .eq("lead_id", leadId)
    .select("id")
    .maybeSingle();

  revalidateLead(leadId);
  if (error) return { error: error.message };
  if (!updated) return { error: "This quotation could not be found." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "lead_updated",
    targetType: "lead",
    targetId: leadId,
    metadata: { fields_changed: ["quotation_discount_approved"] },
  });

  return null;
}
