import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, QualificationField, LeadUpdate } from "@/lib/supabase/types";
import { nextMissingField, draftQuestion, extractAnswer, classifyConfirmation, formatConfirmationSummary, describeKnownFields } from "@/lib/ai/qualification";
import { deliverAiMessage } from "@/lib/ai/deliver";

export type AiSessionTriggerParams = {
  conversationId: string;
  leadId: string | null;
  messageBody: string | null;
};

// Blueprint V1 Phase 6, increment 2: continues a multi-turn qualification
// conversation once a question has actually been sent (increment 1's
// lib/ai/draft-trigger.ts starts it; this picks up every message after).
// Called from lib/whatsapp/ingest.ts BEFORE triggerAutomationForMessage --
// a conversation the AI is already mid-qualification-with must never also
// be matched against an admin-configured automation flow, same exclusivity
// as the reverse direction (increment 1 only starts once automation
// returns "no_match").
//
// Returns true when this conversation belongs to an active AI session
// (whether or not anything was actually sent this turn) -- the caller
// uses this to skip automation/first-reply triggering entirely, not just
// to know whether a message went out.
export async function continueAiSession(supabase: SupabaseClient<Database>, params: AiSessionTriggerParams): Promise<boolean> {
  if (!params.leadId || !params.messageBody) return false;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("ai_session_status, ai_pending_field, ai_collected_data, pending_ai_draft")
    .eq("id", params.conversationId)
    .single();
  if (!conversation?.ai_session_status) return false; // No active session -- not this module's message.

  // A previous AI message is still awaiting staff review -- claim the
  // message (this conversation is AI-owned either way) but take no
  // further action, so we never queue a second, conflicting draft on top
  // of an unreviewed one. Staff sees both messages once they open the
  // conversation and send/discard the pending draft normally.
  if (conversation.pending_ai_draft) return true;

  const { data: settings } = await supabase.from("ai_agent_settings").select("enabled, mode").eq("id", true).single();
  if (!settings?.enabled) return true; // Agent was turned off mid-session -- claim it (stop automation), but go silent.

  if (conversation.ai_session_status === "asking") {
    await handleAsking(supabase, params, conversation.ai_pending_field, conversation.ai_collected_data ?? {}, settings.mode);
    return true;
  }

  // status === "confirming"
  await handleConfirming(supabase, params, conversation.ai_collected_data ?? {}, settings.mode);
  return true;
}

async function handleAsking(
  supabase: SupabaseClient<Database>,
  params: AiSessionTriggerParams,
  pendingField: QualificationField | null,
  collectedSoFar: Record<string, string>,
  mode: "draft" | "automatic",
): Promise<void> {
  if (!pendingField) return; // Shouldn't happen (status "asking" implies a field) -- defensive, nothing sane to do.

  const answer = await extractAnswer(pendingField, params.messageBody!);
  if (!answer) return; // Gemini not configured -- leave the session as-is, try again on the next message.

  if (!answer.answered) {
    // Section 6: "the agent is unsure" -> hand over to a person. Silent --
    // no message sent, staff simply sees the conversation and takes over.
    await endSession(supabase, params.conversationId);
    return;
  }

  const collected = { ...collectedSoFar, [pendingField]: answer.value };
  await persistCollectedData(supabase, params.conversationId, collected);

  const { data: lead } = await supabase.from("leads").select("service_required, project_type, location, estimated_sqft, expected_start_date").eq("id", params.leadId!).single();
  if (!lead) return;

  const known = { ...lead, ...collected };
  const next = nextMissingField(known);

  if (next) {
    const text = await draftQuestion(next, describeKnownFields(lead.service_required, known), params.messageBody!);
    if (!text) return; // Gemini became unconfigured between calls -- data is saved above; just nothing to send this turn.
    await deliverAiMessage(supabase, { conversationId: params.conversationId, mode, text: text.trim(), kind: "question", field: next });
    return;
  }

  const summary = formatConfirmationSummary(lead.service_required, collected);
  await deliverAiMessage(supabase, { conversationId: params.conversationId, mode, text: summary, kind: "confirmation", field: null });
}

async function handleConfirming(
  supabase: SupabaseClient<Database>,
  params: AiSessionTriggerParams,
  collected: Record<string, string>,
  mode: "draft" | "automatic",
): Promise<void> {
  const confirmed = await classifyConfirmation(params.messageBody!);
  if (confirmed === null) return; // Gemini not configured -- leave "confirming" as-is, try again next message.

  if (!confirmed) {
    // R-AI-001: never save unconfirmed data. Silent hand-off, same as the
    // "unsure" case in handleAsking.
    await endSession(supabase, params.conversationId);
    return;
  }

  const update: LeadUpdate = {};
  if (collected.location) update.location = collected.location;
  if (collected.project_type) update.project_type = collected.project_type;
  if (collected.expected_start_date) update.expected_start_date = collected.expected_start_date;
  if (collected.estimated_sqft) {
    const parsed = Number.parseInt(collected.estimated_sqft, 10);
    if (Number.isFinite(parsed) && parsed > 0) update.estimated_sqft = parsed;
  }

  if (Object.keys(update).length > 0) {
    const { data: leadForAudit } = await supabase.from("leads").select("assigned_to_id").eq("id", params.leadId!).single();

    const { error } = await supabase.from("leads").update(update).eq("id", params.leadId!);
    if (error) {
      console.error("Failed to save AI-confirmed lead fields:", error.message);
      // Fields never saved -- do not claim the session is done or send a
      // closing message implying it worked. End the session and let
      // staff pick this up manually rather than silently losing the data.
      await endSession(supabase, params.conversationId);
      return;
    }

    // R-AI-001: "tagged AI until verified." audit_logs.actor_id is a
    // required FK to profiles(id) -- there's no "system" profile in this
    // schema, so a webhook-initiated write is attributed to the lead's
    // assigned staff member (same person who'll see this come through
    // their own conversation) with source: "ai_agent" in metadata as the
    // actual tag, distinguishing it from a write that staff member made
    // by hand. Written directly via the admin client, NOT
    // lib/audit.ts's recordAuditEvent -- that helper opens its own
    // cookie-scoped client and requires actor_id = auth.uid(), neither
    // of which exists in this webhook context. Skipped (not retried) for
    // an unassigned lead -- fail-open, same as every other audit write.
    if (leadForAudit?.assigned_to_id) {
      const { error: auditError } = await supabase.from("audit_logs").insert({
        actor_id: leadForAudit.assigned_to_id,
        action: "lead_updated",
        target_type: "lead",
        target_id: params.leadId!,
        metadata: { fields_changed: Object.keys(update), source: "ai_agent" },
      });
      if (auditError) {
        console.error("Failed to record AI lead-update audit event:", auditError.message);
      }
    }
  }

  await endSession(supabase, params.conversationId);

  const text = "Thanks! One of our team will reach out shortly to arrange a site visit.";
  await deliverAiMessage(supabase, { conversationId: params.conversationId, mode, text, kind: "closing", field: null });
}

async function persistCollectedData(supabase: SupabaseClient<Database>, conversationId: string, collected: Record<string, string>): Promise<void> {
  const { error } = await supabase.from("conversations").update({ ai_collected_data: collected, ai_session_status: null, ai_pending_field: null }).eq("id", conversationId);
  if (error) {
    console.error("Failed to persist AI-collected qualification data:", error.message);
  }
}

async function endSession(supabase: SupabaseClient<Database>, conversationId: string): Promise<void> {
  const { error } = await supabase.from("conversations").update({ ai_session_status: null, ai_pending_field: null, ai_collected_data: null }).eq("id", conversationId);
  if (error) {
    console.error("Failed to end AI session:", error.message);
  }
}
