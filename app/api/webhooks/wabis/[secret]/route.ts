import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidWabisSecret } from "@/lib/whatsapp/wabis-auth";
import { parseWabisMessage } from "@/lib/whatsapp/parse-wabis";
import { ingestInboundMessage } from "@/lib/whatsapp/ingest";

// Needs the Node.js runtime for node:crypto (timing-safe secret comparison).
export const runtime = "nodejs";

// WABIS's outbound webhook has no signature, header, or API-key mechanism
// of its own (confirmed against the live account) — this high-entropy URL
// path segment is the only credential, checked in constant time against
// WABIS_WEBHOOK_SECRET. A wrong or missing secret returns 404 rather than
// 401/403 so a prober cannot distinguish "wrong secret" from "no such
// route" — appropriate for a capability-URL model where the path itself is
// the credential. Never log the secret value.
export async function POST(request: NextRequest, context: { params: Promise<{ secret: string }> }) {
  const expectedSecret = process.env.WABIS_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error("WABIS_WEBHOOK_SECRET is not set; rejecting webhook delivery.");
    return new NextResponse("Not found", { status: 404 });
  }

  const { secret } = await context.params;
  if (!isValidWabisSecret(secret, expectedSecret)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const message = parseWabisMessage(payload);
  if (!message) {
    return new NextResponse("Malformed payload", { status: 400 });
  }

  const supabase = createAdminClient();
  const result = await ingestInboundMessage(supabase, message);

  // A genuine ingestion failure (e.g. the Supabase lookup/insert itself
  // erroring) must not be ACKed as success -- WABIS's own confirmed
  // duplicate-delivery/retry behavior only gives this message another
  // chance to be ingested if it sees a non-2xx response. A successful
  // idempotent no-op (an already-recorded duplicate) is still a 200.
  if (result.status === "failed") {
    return new NextResponse("Ingestion failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
