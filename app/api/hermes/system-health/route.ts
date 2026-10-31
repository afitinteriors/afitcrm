import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import { getSystemHealth } from "@/lib/hermes/system-health";
import { recordAgentEvent } from "@/lib/hermes/agent-events";

export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5: the "System health" job (every 15 min).
// See lib/hermes/system-health.ts's own comment for why this covers only
// webhook silence, not failed sends/AI errors/template rejections -- those
// have no real data source to report on this app's current live setup.
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
  const health = await getSystemHealth(admin, new Date());

  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "system-health",
    summary: health.webhookSilent
      ? `Webhook silent for ${health.minutesSinceLastInbound} min.`
      : "Webhook healthy.",
    metadata: health,
  });

  return NextResponse.json(health);
}
