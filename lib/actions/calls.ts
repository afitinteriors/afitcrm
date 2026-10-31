"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { CALL_OUTCOME_EXEMPT_FROM_FOLLOWUP, CALL_OUTCOMES } from "@/lib/constants";
import { needsMissedCallTemplate, sendMissedCallTemplate } from "@/lib/whatsapp/missed-call-template";
import type { CallOutcome } from "@/lib/supabase/types";

export type PendingCall = {
  id: string;
  leadId: string;
  customerName: string | null;
  phone: string;
  startedAt: string;
  // Lets the popup waive R-CALL-002's date requirement on reopen (page
  // reload / refocus) exactly the same way it does when freshly opened via
  // CallButton -- see leadAlreadyLost in resolveCallOutcome below, the
  // server-side source of truth this mirrors for the UI only.
  leadAlreadyLost: boolean;
};

export type StartCallResult = { ok: true; callLogId: string; leadId: string } | { error: string };
export type ResolveCallResult = { ok: true } | { error: string };

function isCallOutcome(value: string): value is CallOutcome {
  return (CALL_OUTCOMES as string[]).includes(value);
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

// Returns the signed-in caller's single unresolved call, if any. This is
// what lets the outcome popup reopen on the next page load or when the
// app regains focus (R-CALL-001), instead of silently disappearing if the
// tab was closed or the app lost focus mid-call.
export async function getMyPendingCall(): Promise<PendingCall | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("call_logs")
    .select("id, lead_id, started_at, leads(customer_name, phone, status)")
    .eq("caller_id", profile.id)
    .is("outcome", null)
    .maybeSingle();

  const row = data as unknown as
    | {
        id: string;
        lead_id: string;
        started_at: string;
        leads:
          | { customer_name: string | null; phone: string; status: string }
          | { customer_name: string | null; phone: string; status: string }[]
          | null;
      }
    | null;
  if (!row) return null;
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
  if (!lead) return null;

  return {
    id: row.id,
    leadId: row.lead_id,
    customerName: lead.customer_name,
    phone: lead.phone,
    startedAt: row.started_at,
    leadAlreadyLost: lead.status === "lost",
  };
}

// Called the instant "Call now" is pressed, before the outcome is known.
// Idempotent for a double-press on the SAME lead (returns the existing
// pending row instead of erroring); a pending call for a DIFFERENT lead is
// reported back so the UI can tell the caller to resolve it first --
// call_logs_one_pending_per_caller (unique index) is the actual guard, this
// is just a friendly message on top of it.
export async function startCall(leadId: string): Promise<StartCallResult> {
  if (!leadId) return { error: "Missing lead." };
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("call_logs")
    .insert({ lead_id: leadId, caller_id: profile.id })
    .select("id, lead_id")
    .single();

  if (!error && data) return { ok: true, callLogId: data.id, leadId: data.lead_id };

  // 23505 = unique_violation: call_logs_one_pending_per_caller already has
  // an unresolved row for this caller.
  if (error?.code === "23505") {
    const { data: pending } = await supabase
      .from("call_logs")
      .select("id, lead_id")
      .eq("caller_id", profile.id)
      .is("outcome", null)
      .maybeSingle();
    if (pending) {
      if (pending.lead_id === leadId) return { ok: true, callLogId: pending.id, leadId: pending.lead_id };
      return { error: "Finish logging your previous call before starting another." };
    }
  }

  return { error: "Could not start the call log. You may not have access to this lead." };
}

// Resolves a pending call: fills in the outcome (R-CALL-001), enforces the
// required follow-up date (R-CALL-002), completes any earlier pending
// "call" follow-up on the same lead so follow-ups don't pile up, creates
// the new one when a date was given, and records the audit event.
//
// leadId is deliberately NOT a parameter -- it is read back from the
// call_logs row the UPDATE actually touched, not trusted from the client,
// so a mismatched/forged id can't redirect the follow-up write elsewhere.
// RLS (call_logs_update_resolve_own_pending) also scopes the update to the
// signed-in caller's own still-pending row; a stray callLogId for someone
// else's call matches zero rows.
export async function resolveCallOutcome(
  callLogId: string,
  outcome: string,
  notes: string,
  nextFollowUpDate: string,
): Promise<ResolveCallResult> {
  if (!callLogId) return { error: "Missing call." };
  if (!isCallOutcome(outcome)) return { error: "Pick a call outcome." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();

  // R-CALL-002 (docs/BLUEPRINT_V1.md Blueprint V1): "except Wrong number
  // and Lost" -- Lost refers to the LEAD's current pipeline status, not a
  // call outcome (there is no such outcome). A call logged against a lead
  // that's already closed Lost has nothing left to follow up on, so the
  // date requirement is waived the same as Wrong number. Resolved from the
  // call_logs row itself (scoped the same way the UPDATE below is scoped --
  // caller's own still-pending row), not trusted from the client, so this
  // can't be spoofed by passing a different lead's status. The matching DB
  // trigger (supabase/migrations -- call_logs_followup_required) carries
  // the identical exception so a bug here can't silently create a dateless
  // requirement for a non-Lost lead.
  const { data: pendingCallData } = await supabase
    .from("call_logs")
    .select("id, lead_id, leads(status)")
    .eq("id", callLogId)
    .eq("caller_id", profile.id)
    .is("outcome", null)
    .maybeSingle();

  const pendingCall = pendingCallData as unknown as
    | { id: string; lead_id: string; leads: { status: string } | { status: string }[] | null }
    | null;
  if (!pendingCall) return { error: "Could not log this call outcome. You may not have access to it." };

  const leadRef = pendingCall.leads;
  const leadStatus = Array.isArray(leadRef) ? leadRef[0]?.status : leadRef?.status;
  const leadAlreadyLost = leadStatus === "lost";

  const dateRequired = outcome !== CALL_OUTCOME_EXEMPT_FROM_FOLLOWUP && !leadAlreadyLost;
  if (dateRequired && (!nextFollowUpDate || !isValidDate(nextFollowUpDate))) {
    return { error: "Pick a valid next follow-up date." };
  }
  if (nextFollowUpDate && !isValidDate(nextFollowUpDate)) {
    return { error: "Pick a valid next follow-up date." };
  }

  const resolvedAt = new Date().toISOString();
  const followUpDate = nextFollowUpDate || null;

  const { data: updated, error: updateError } = await supabase
    .from("call_logs")
    .update({
      outcome,
      notes: notes || null,
      next_follow_up_date: followUpDate,
      resolved_at: resolvedAt,
    })
    .eq("id", callLogId)
    .select("id, lead_id")
    .maybeSingle();

  if (updateError || !updated) return { error: "Could not log this call outcome. You may not have access to it." };

  const leadId = updated.lead_id;

  // R-FUP-002 (docs/BLUEPRINT_V1.md Section 8): "If a call is not
  // answered, the customer gets an approved WhatsApp template." Best-effort
  // and non-blocking -- the call outcome itself is already durably
  // recorded above regardless of whether this send succeeds; a missing
  // WHATSAPP_MISSED_CALL_TEMPLATE_NAME (not yet configured) or missing
  // conversation is an expected, silent no-op here, not something to
  // surface as an error on the call-logging form.
  if (needsMissedCallTemplate(outcome)) {
    try {
      const result = await sendMissedCallTemplate(supabase, leadId);
      if (result.status === "failed") {
        console.error("Missed-call template send failed:", result.reason);
      }
    } catch (err) {
      console.error("Missed-call template send failed unexpectedly:", err instanceof Error ? err.message : err);
    }
  }

  // Requirement: don't let completed calls pile up pending follow-ups --
  // complete every still-pending "call" follow-up on this lead before
  // creating the new one.
  await supabase
    .from("follow_ups")
    .update({ status: "completed", completed_at: resolvedAt })
    .eq("lead_id", leadId)
    .eq("type", "call")
    .eq("status", "pending");

  if (followUpDate) {
    await supabase.from("follow_ups").insert({
      lead_id: leadId,
      type: "call",
      due_date: followUpDate,
      notes: notes || null,
      assigned_to_id: profile.id,
    });
  }

  await recordAuditEvent({
    actorId: profile.id,
    action: "call_logged",
    targetType: "lead",
    targetId: leadId,
    metadata: { outcome, call_log_id: callLogId },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");
  revalidatePath("/today");
  return { ok: true };
}
