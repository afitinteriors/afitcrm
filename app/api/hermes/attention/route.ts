import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import { getAttentionItems } from "@/lib/hermes/attention";
import { recordAgentEvent } from "@/lib/hermes/agent-events";

// Needs the Node.js runtime for node:crypto (timing-safe key comparison,
// same as the cron routes and the WABIS webhook).
export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5 -- the first /api/hermes/* tool: "what
// needs attention right now" (lib/hermes/attention.ts), feeding Hermes's
// Morning list and Response chase jobs. Auth and the "don't reveal the
// route exists" 404-on-failure convention match the cron routes exactly --
// same reasoning, different caller.
export async function GET(request: NextRequest) {
  const expectedKey = process.env.HERMES_API_KEY;
  if (!expectedKey) {
    console.error("HERMES_API_KEY is not set; rejecting Hermes tool request.");
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isValidHermesApiKey(request.headers.get("authorization"), expectedKey)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const items = await getAttentionItems(admin, new Date());

  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "attention",
    summary: `Read ${items.length} lead(s) needing attention.`,
    metadata: { count: items.length, reasonCounts: countByReason(items) },
  });

  return NextResponse.json({ items });
}

function countByReason(items: { reasonKind: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.reasonKind] = (counts[item.reasonKind] ?? 0) + 1;
  return counts;
}
