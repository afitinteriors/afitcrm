import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { triggerAutomationForMessage } from "@/lib/automations/trigger";
import { createOrLinkLeadForConversation } from "@/lib/automations/crm-actions";

// Minimal shape needed to ingest one inbound message into
// conversations/messages, shared by every inbound source (Meta Cloud API,
// WABIS). A source's own richer parsed-message type (e.g. Meta's
// ParsedWhatsAppMessage, which also carries `timestamp`) is structurally
// assignable here as long as it has these fields.
export type InboundWhatsAppMessage = {
  waMessageId: string;
  phoneNumberId: string;
  fromPhone: string;
  customerName: string | null;
  messageType: string;
  body: string | null;
  mediaId: string | null;
  referral: unknown;
  raw: unknown;
  // Optional, source-routing-derived hint (not parsed from message content)
  // that a lead matched by phone belongs to a specific service. Only ever
  // set by a parser dedicated to a single-service source (currently: the
  // Gypsum Plaster WABIS endpoint's parseWabisMessage). Meta-sourced
  // messages never set this, so Meta ingestion is unaffected.
  serviceHint?: string | null;
};

export async function findLeadByExactPhone(
  supabase: SupabaseClient<Database>,
  phone: string
): Promise<string | null> {
  const { data, error } = await supabase.from("leads").select("id").eq("phone", phone).limit(2);
  // 0 matches (no lead yet) or 2+ matches (ambiguous) both fail closed to "unlinked".
  if (error || !data || data.length !== 1) return null;
  return data[0].id;
}

export async function findOrCreateConversation(
  supabase: SupabaseClient<Database>,
  message: InboundWhatsAppMessage
): Promise<{ conversationId: string; leadId: string | null } | null> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id, lead_id")
    .eq("wa_id", message.fromPhone)
    .eq("phone_number_id", message.phoneNumberId)
    .maybeSingle();

  if (findError) {
    console.error("Failed to look up WhatsApp conversation:", findError.message);
    return null;
  }
  if (existing) return { conversationId: existing.id, leadId: existing.lead_id };

  // Exact phone match only — an ambiguous or missing match leaves the
  // conversation unlinked rather than guessing which lead it belongs to.
  const leadId = await findLeadByExactPhone(supabase, message.fromPhone);

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({
      lead_id: leadId,
      wa_id: message.fromPhone,
      phone_number_id: message.phoneNumberId,
    })
    .select("id")
    .single();

  if (createError || !created) {
    console.error("Failed to create WhatsApp conversation:", createError?.message);
    return null;
  }

  if (leadId && message.referral && typeof message.referral === "object") {
    await applyReferralToLead(supabase, leadId, message.referral as Record<string, unknown>);
  }

  return { conversationId: created.id, leadId };
}

// Only maps the CTWA referral field that Meta's documented `referral` object
// actually contains (source_id = the ad ID). campaign/ad-set names are not
// part of this payload and are deliberately left untouched rather than
// guessed. Never reached for a source (e.g. WABIS) whose parser always sets
// `referral: null`.
async function applyReferralToLead(
  supabase: SupabaseClient<Database>,
  leadId: string,
  referral: Record<string, unknown>
) {
  const adId = typeof referral.source_id === "string" ? referral.source_id : null;
  if (!adId) return;

  const { error } = await supabase.from("leads").update({ ad_id: adId }).eq("id", leadId).is("ad_id", null);
  if (error) {
    console.error("Failed to apply CTWA referral to lead:", error.message);
  }
}

// Fill-if-empty, same never-clobber convention as applyReferralToLead
// (.is("ad_id", null)) and lib/automations/crm-actions.ts's own
// service_required write. Never touches pipeline status, never creates a
// lead. Only reached when the source parser sets serviceHint — currently
// only the dedicated Gypsum Plaster WABIS endpoint's parseWabisMessage;
// Meta-sourced messages always have serviceHint undefined and never reach
// this call.
async function applyServiceHintToLead(supabase: SupabaseClient<Database>, leadId: string, serviceHint: string) {
  const { error } = await supabase
    .from("leads")
    .update({ service_required: serviceHint })
    .eq("id", leadId)
    .is("service_required", null);

  if (error) {
    console.error("Failed to apply service hint to lead:", error.message);
  }
}

export async function ingestInboundMessage(
  supabase: SupabaseClient<Database>,
  message: InboundWhatsAppMessage
): Promise<void> {
  const conversationResult = await findOrCreateConversation(supabase, message);
  if (!conversationResult) return;
  const { conversationId, leadId } = conversationResult;

  if (leadId) {
    if (message.serviceHint) {
      await applyServiceHintToLead(supabase, leadId, message.serviceHint);
    }
  } else if (message.serviceHint) {
    // Routing-identified only (message.serviceHint is set only by a
    // single-service source's own parser -- currently the Gypsum Plaster
    // WABIS endpoint) -- never content-classified. Reuses the automation
    // system's own webhook-context lead creation
    // (lib/automations/crm-actions.ts) rather than duplicating its
    // exact-phone-match / fill-if-empty / create-or-link rules. Best-effort:
    // a failure here must never break message persistence or the webhook's
    // own ack, same convention as triggerAutomationForMessage below.
    try {
      await createOrLinkLeadForConversation(supabase, {
        conversationId,
        phone: message.fromPhone,
        customerName: message.customerName,
        serviceName: message.serviceHint,
      });
    } catch (err) {
      console.error(
        "Failed to create/link a lead for a new service-hinted contact:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      wa_message_id: message.waMessageId,
      direction: "inbound",
      message_type: message.messageType,
      body: message.body,
      media_id: message.mediaId,
      raw_payload: message.raw,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    if (error?.code !== "23505") {
      // 23505 = unique_violation on wa_message_id -> already recorded (retry), not an error.
      console.error("Failed to persist WhatsApp message:", error?.message);
    }
    // Either way, no new row was inserted this call -- don't touch the
    // conversation's updated_at for a retry/duplicate delivery, and don't
    // evaluate automations for a message that was already processed.
    return;
  }

  // Bumps the conversation to the top of the list / refreshes its "time
  // ago" label. Only reached after a genuine new insert above -- there's
  // still no DB trigger for this (none exist anywhere in this schema), so
  // it's done explicitly here, matching every other update in this codebase.
  const { error: touchError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (touchError) {
    console.error("Failed to update conversation updated_at after inbound message:", touchError.message);
  }

  // Keyword-triggered service automation is a pure add-on to inbound
  // ingestion -- the message above is already durably persisted regardless
  // of what happens here. Any failure is caught locally so it can never
  // affect the webhook's own response or cause a retry that would
  // re-process an already-recorded message.
  try {
    await triggerAutomationForMessage(supabase, {
      messageId: inserted.id,
      conversationId,
      body: message.body,
      phone: message.fromPhone,
      customerName: message.customerName,
    });
  } catch (err) {
    console.error("Automation trigger failed unexpectedly:", err instanceof Error ? err.message : err);
  }
}
