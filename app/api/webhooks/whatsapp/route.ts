import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMetaSignature } from "@/lib/whatsapp/verify-signature";
import { parseWhatsAppWebhookPayload } from "@/lib/whatsapp/parse-webhook";
import { describeShape } from "@/lib/whatsapp/describe-shape";

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

// --- POST: incoming WhatsApp message events ----------------------------

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

  const messages = parseWhatsAppWebhookPayload(payload);

  // Always acknowledge quickly — Meta retries deliveries that don't get a
  // fast 2xx, and a payload with only status callbacks (delivered/read)
  // legitimately has zero messages to record.
  if (messages.length === 0) {
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  for (const message of messages) {
    const { error } = await supabase.from("leads").insert({
      customer_name: message.customerName,
      phone: message.fromPhone,
      whatsapp_message: message.messageText,
      source: "whatsapp",
      status: "new",
      wa_message_id: message.waMessageId,
      wa_phone_number_id: message.phoneNumberId || null,
      wa_message_timestamp: message.timestamp,
    });

    if (error && error.code !== "23505") {
      // 23505 = unique_violation on wa_message_id -> already recorded, not an error.
      console.error("Failed to create lead from WhatsApp message:", error.message);
    }
  }

  return NextResponse.json({ received: true });
}
