import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidWabisSecret } from "@/lib/whatsapp/wabis-auth";
import { parseWabisMessage } from "@/lib/whatsapp/parse-wabis";
import { ingestInboundMessage } from "@/lib/whatsapp/ingest";
import { describeShape } from "@/lib/whatsapp/describe-shape";

// TEMPORARY DIAGNOSTIC (approved for one production capture, remove once the
// real WABIS payload shape is confirmed and the parser is updated to match
// it): the two prior real WABIS deliveries both hit this route and returned
// 400 from parseWabisMessage()/JSON parsing, with no way to tell why -- this
// route never logged the payload, and Vercel's own request logs don't retain
// bodies. describeShape() (lib/whatsapp/describe-shape.ts) reduces a value to
// key names + value *types* only, recursively -- never the actual value --
// so this is safe to log even though WABIS's real payload carries a phone
// number, a name, and message text.
const WABIS_REQUIRED_FIELDS = [
  "chat_id",
  "postbackid",
  "whatsapp_bot_username",
  "first_name",
  "user_message",
  "user_input_data",
] as const;

function describeRequiredFieldTypes(payload: unknown): Record<string, unknown> {
  const obj = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const result: Record<string, unknown> = {};
  for (const key of WABIS_REQUIRED_FIELDS) {
    result[key] = key in obj ? describeShape(obj[key]) : "missing";
  }
  return result;
}

// TEMPORARY DIAGNOSTIC, narrower follow-up: the shape-only log above showed
// all three identity fields as JS type "string" on a real WABIS delivery
// that still got rejected -- but parseWabisMessage()'s own isNonEmptyString
// check (this same file's twin in parse-wabis.ts) additionally requires
// length > 0, which describeShape() can't distinguish (it only reports
// typeof). This reports exactly that length check's outcome -- never the
// string content itself, only a category plus the numeric length (a count,
// not the value) for the non-empty case.
const WABIS_IDENTITY_FIELDS = ["chat_id", "postbackid", "whatsapp_bot_username"] as const;

function describeIdentityFieldLengths(payload: unknown): Record<string, unknown> {
  const obj = payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
  const result: Record<string, unknown> = {};
  for (const key of WABIS_IDENTITY_FIELDS) {
    if (!(key in obj)) {
      result[key] = "missing";
      continue;
    }
    const value = obj[key];
    if (typeof value !== "string") {
      result[key] = "not-a-string";
      continue;
    }
    result[key] = value.length === 0 ? "empty-string" : { status: "non-empty-string", length: value.length };
  }
  return result;
}

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
    // TEMPORARY DIAGNOSTIC -- see block above. Structure only, no body content.
    console.log("[wabis-diagnostic] JSON parsing failed");
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // TEMPORARY DIAGNOSTIC -- see block above. Logs field names/types only.
  console.log("[wabis-diagnostic] JSON parsed ok, top-level shape:", JSON.stringify(describeShape(payload)));
  console.log(
    "[wabis-diagnostic] parser-required field types:",
    JSON.stringify(describeRequiredFieldTypes(payload))
  );
  console.log(
    "[wabis-diagnostic] identity field length check:",
    JSON.stringify(describeIdentityFieldLengths(payload))
  );

  const message = parseWabisMessage(payload);
  if (!message) {
    return new NextResponse("Malformed payload", { status: 400 });
  }

  const supabase = createAdminClient();
  await ingestInboundMessage(supabase, message);

  return NextResponse.json({ received: true });
}
