import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMetaSignature } from "@/lib/whatsapp/verify-signature";
import {
  parseWhatsAppMessages,
  parseWhatsAppStatuses,
  type ParsedWhatsAppMessage,
} from "@/lib/whatsapp/parse-webhook";
import { describeShape } from "@/lib/whatsapp/describe-shape";
import { triggerAutomationForMessage } from "@/lib/automations/trigger";
import type { Database } from "@/lib/supabase/types";

// Needs the Node.js runtime for node:crypto (HMAC signature verification).
export const runtime = "nodejs";

// --- GET: Meta's webhook verification handshake -----------------------

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (verifyToken && mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// --- POST: incoming WhatsApp message/status events ----------------------

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("WHATSAPP_APP_SECRET is not set; rejecting webhook delivery.");
    return new NextResponse("Server not configured", { status: 500 });
  }

  // Read the raw body BEFORE any JSON parsing — the signature is computed
  // over the exact bytes Meta sent, not a re-serialized copy.
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    // TEMPORARY — payload-shape discovery for the WABIS integration.
    // Only engages when WEBHOOK_DISCOVERY_MODE=true is explicitly set.
    // Logs field names/types/nesting only, never values or headers, makes
    // no Supabase calls, and always returns 200. Remove once WABIS's
    // payload shape is known and the real WABIS parser ships.
    if (process.env.WEBHOOK_DISCOVERY_MODE === "true") {
      try {
        const parsed = JSON.parse(rawBody);
        console.log("[webhook-discovery] payload shape:", JSON.stringify(describeShape(parsed)));
      } catch {
        console.log("[webhook-discovery] body was not valid JSON (shape: n/a)");
      }
      return NextResponse.json({ discovery: true });
    }

    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const supabase = createAdminClient();

  const messages = parseWhatsAppMessages(payload);
  for (const message of messages) {
    await ingestMessage(supabase, message);
  }

  const statuses = parseWhatsAppStatuses(payload);
  for (const status of statuses) {
    const { error } = await supabase
      .from("messages")
      .update({ status: status.status })
      .eq("wa_message_id", status.waMessageId);
    // No row matches when a status callback arrives for a message we never
    // recorded (e.g. an outbound message sent outside this system) — not an error.
    if (error) {
      console.error("Failed to update WhatsApp message status:", error.message);
    }
  }

  // Always acknowledge with 2xx — Meta retries deliveries that don't get one,
  // and any per-item failures above are already logged individually.
  return NextResponse.json({ received: true });
}

// --- Ingestion helpers ---------------------------------------------------

async function ingestMessage(supabase: SupabaseClient<Database>, message: ParsedWhatsAppMessage) {
  const conversationId = await findOrCreateConversation(supabase, message);
  if (!conversationId) return;

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

  // Keyword-triggered service automation (Phase 2) is a pure add-on to
  // inbound ingestion -- the message above is already durably persisted
  // regardless of what happens here. Any failure is caught locally so it
  // can never affect the webhook's own 2xx response to Meta or cause a
  // retry that would re-process an already-recorded message.
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

async function findOrCreateConversation(
  supabase: SupabaseClient<Database>,
  message: ParsedWhatsAppMessage
): Promise<string | null> {
  const { data: existing, error: findError } = await supabase
    .from("conversations")
    .select("id")
    .eq("wa_id", message.fromPhone)
    .eq("phone_number_id", message.phoneNumberId)
    .maybeSingle();

  if (findError) {
    console.error("Failed to look up WhatsApp conversation:", findError.message);
    return null;
  }
  if (existing) return existing.id;

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

  return created.id;
}

async function findLeadByExactPhone(
  supabase: SupabaseClient<Database>,
  phone: string
): Promise<string | null> {
  const { data, error } = await supabase.from("leads").select("id").eq("phone", phone).limit(2);
  // 0 matches (no lead yet) or 2+ matches (ambiguous) both fail closed to "unlinked".
  if (error || !data || data.length !== 1) return null;
  return data[0].id;
}

// Only maps the CTWA referral field that Meta's documented `referral` object
// actually contains (source_id = the ad ID). campaign/ad-set names are not
// part of this payload and are deliberately left untouched rather than guessed.
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
