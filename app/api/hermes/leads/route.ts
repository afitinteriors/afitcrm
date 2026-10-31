import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import { queryLeads } from "@/lib/hermes/leads-query";
import { recordAgentEvent } from "@/lib/hermes/agent-events";

export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5: "Read leads, deals" and the "Ask
// anything" job (e.g. "Kollam leads this week?" -> ?location=Kollam&
// datePreset=last7). Query params mirror the Leads list's own filter
// names (lib/leads.ts's LeadFilters) for familiarity, but this route is
// independent of it -- see lib/hermes/leads-query.ts's own comment.
export async function GET(request: NextRequest) {
  const expectedKey = process.env.HERMES_API_KEY;
  if (!expectedKey) {
    console.error("HERMES_API_KEY is not set; rejecting Hermes tool request.");
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isValidHermesApiKey(request.headers.get("authorization"), expectedKey)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const filters = {
    status: params.get("status") ?? undefined,
    location: params.get("location") ?? undefined,
    assignedToId: params.get("assignedToId") ?? undefined,
    datePreset: params.get("datePreset") ?? undefined,
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
  };

  const admin = createAdminClient();
  const items = await queryLeads(admin, filters);

  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "leads.query",
    summary: `Read ${items.length} lead(s) matching the given filters.`,
    metadata: { count: items.length, filters },
  });

  return NextResponse.json({ items });
}
