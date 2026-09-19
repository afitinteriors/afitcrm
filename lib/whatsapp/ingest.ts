import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { triggerAutomationForMessage } from "@/lib/automations/trigger";
import { createOrLinkLeadForConversation } from "@/lib/automations/crm-actions";
import { toCanonicalPhone } from "@/lib/phone";

// Minimal shape needed to ingest one inbound message into
// conversations/messages, shared by every inbound source (Meta Cloud API,
// WABIS). A source's own richer parsed-message type (e.g. Meta's
// ParsedWhatsAppMessage, which also carries `timestamp`) is structurally
// assignable here as long as it has these fields.
export type InboundWhatsAppMessage = {
  // Meta always supplies a real message id. WABIS's payload carries no
  // dedicated message-id field -- its optional postbackid (an event/
  // idempotency identifier, not a message id) is used when present and
  // non-empty; null otherwise, meaning "no idempotency key for this
  // message" rather than an error.
  waMessageId: string | null;
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

async function findLeadIdByPhoneExact(supabase: SupabaseClient<Database>, phone: string): Promise<string | null> {
  // Excludes retired/merged leads (merged_into_id set) -- same "active
  // leads only" convention as lib/leads.ts's getLeads(). A phone that only
  // matches a merged lead is treated as no match, same as if it matched
  // nothing at all, rather than reviving a retired record.
  const { data, error } = await supabase.from("leads").select("id").eq("phone", phone).is("merged_into_id", null).limit(2);
  // 0 matches (no lead yet) or 2+ matches (ambiguous) both fail closed to "unlinked".
  if (error || !data || data.length !== 1) return null;
  return data[0].id;
}

// Looks up by the canonical E.164 form of `phone` (see lib/phone.ts) so
// +91/91/bare-national Indian variants, and international numbers by their
// real country code, all resolve to the same lead. Falls back to an exact
// match on the raw, uncanonicalized input when the canonical lookup misses
// -- this project has not backfilled existing leads.phone values to
// canonical form (a separate, not-yet-approved migration), so a lead
// created before canonicalization was introduced may still be stored in
// its original raw shape. This fallback narrows, but does not eliminate,
// the transition-period duplicate-lead risk for such pre-existing leads;
// see lib/phone.ts and this project's phone-normalization investigation
// notes for the full caveat. Unparseable input falls back to the exact
// pre-canonicalization behavior (match the raw string as given) rather
// than refusing to look up at all.
export async function findLeadByExactPhone(
  supabase: SupabaseClient<Database>,
  phone: string
): Promise<string | null> {
  const canonical = toCanonicalPhone(phone);
  if (!canonical.ok) return findLeadIdByPhoneExact(supabase, phone);

  const match = await findLeadIdByPhoneExact(supabase, canonical.e164);
  if (match) return match;

  if (phone !== canonical.e164) {
    return findLeadIdByPhoneExact(supabase, phone);
  }
  return null;
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

// Lets the webhook route distinguish a genuine ingestion failure (must not
// be ACKed as success -- the source should be allowed to retry) from a
// successful outcome, duplicate deliveries included ("duplicate" is a
// successful idempotent no-op, not a failure). Best-effort side effects
// (service-hint lead linking, automation triggering) never surface as
// "failed" here -- same convention as before this type existed, since a
// message that's durably persisted must never be treated as un-ingested
// just because an add-on side effect broke.
export type IngestOutcome = { status: "ingested" } | { status: "duplicate" } | { status: "failed"; reason: string };

export async function ingestInboundMessage(
  supabase: SupabaseClient<Database>,
  message: InboundWhatsAppMessage
): Promise<IngestOutcome> {
  const conversationResult = await findOrCreateConversation(supabase, message);
  if (!conversationResult) {
    return { status: "failed", reason: "Failed to find or create the WhatsApp conversation." };
  }
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
    // 23505 = unique_violation on wa_message_id -> already recorded (retry):
    // a successful idempotent no-op, not a failure. Anything else is a
    // genuine persistence failure the caller must not ACK as success.
    if (error?.code === "23505") {
      return { status: "duplicate" };
    }
    console.error("Failed to persist WhatsApp message:", error?.message);
    return { status: "failed", reason: error?.message ?? "Failed to persist the inbound WhatsApp message." };
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

  return { status: "ingested" };
}
