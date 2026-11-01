import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import { getDailyReport } from "@/lib/hermes/daily-report";
import { recordAgentEvent } from "@/lib/hermes/agent-events";
import { businessDate } from "@/lib/business-time";

export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5: the "Nightly report" job's data source
// (20:00 daily -- Leads in, called, first response under 15 min, visits
// fixed, quotes sent, won, lost, per staff) and "Ask anything" (e.g.
// "Kollam leads this week?" needs *a* day to start from). `date` defaults
// to today (business zone); Hermes may also pass an earlier date, e.g. for
// the 20:00 job to summarize the day that's ending rather than whatever
// day it happens to run in.
export async function GET(request: NextRequest) {
  const expectedKey = process.env.HERMES_API_KEY;
  if (!expectedKey) {
    console.error("HERMES_API_KEY is not set; rejecting Hermes tool request.");
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isValidHermesApiKey(request.headers.get("authorization"), expectedKey)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const requestedDate = request.nextUrl.searchParams.get("date");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : businessDate();

  const admin = createAdminClient();
  const perStaff = await getDailyReport(admin, date);

  await recordAgentEvent(admin, {
    eventType: "read",
    toolName: "reports.daily",
    summary: `Read the ${date} daily report (${perStaff.length} staff).`,
    metadata: { date, staffCount: perStaff.length },
  });

  return NextResponse.json({ date, perStaff });
}
