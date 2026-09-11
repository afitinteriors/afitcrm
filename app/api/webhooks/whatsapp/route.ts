import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyMetaSignature } from "@/lib/whatsapp/verify-signature";
import { parseWhatsAppMessages, parseWhatsAppStatuses } from "@/lib/whatsapp/parse-webhook";
import { describeShape } from "@/lib/whatsapp/describe-shape";
import { ingestInboundMessage } from "@/lib/whatsapp/ingest";

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
    await ingestInboundMessage(supabase, message);
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
