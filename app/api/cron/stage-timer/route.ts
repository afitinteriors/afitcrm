import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidCronSecret } from "@/lib/cron-auth";
import { isBusinessHours } from "@/lib/business-time";
import { BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR } from "@/lib/constants";
import { bucketStageOverdue, findStageTrackedLeads } from "@/lib/rules/stage-timer";
import { sendStageAlerts } from "@/lib/rules/stage-alerts";

// Needs the Node.js runtime for node:crypto (timing-safe secret comparison,
// same as the WABIS webhook route and /api/cron/response-timer).
export const runtime = "nodejs";

// R-STAGE-002 (docs/BLUEPRINT_V1.md Section 8), Blueprint V1 Phase 4 --
// invoked every 5 minutes by Vercel Cron (vercel.json), same auth
// convention as /api/cron/response-timer: Vercel sends
// `Authorization: Bearer <CRON_SECRET>`, a missing/wrong secret gets a
// plain 404.
export async function GET(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("CRON_SECRET is not set; rejecting cron request.");
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isValidCronSecret(request.headers.get("authorization"), expectedSecret)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const now = new Date();

  // Same simplified "skip outside business hours" treatment as
  // /api/cron/response-timer -- see that route for the full reasoning.
  if (!isBusinessHours(now, BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR)) {
    return NextResponse.json({ skipped: "outside business hours" });
  }

  const admin = createAdminClient();

  const tracked = await findStageTrackedLeads(admin);
  const { overdueStaff, overdueOwner } = bucketStageOverdue(tracked, now);

  const { data: adminProfiles } = await admin.from("profiles").select("id").eq("role", "admin").eq("active", true);
  const adminIds = (adminProfiles ?? []).map((p) => p.id);

  await sendStageAlerts(admin, overdueStaff, (lead) => (lead.assigned_to_id ? [lead.assigned_to_id] : adminIds), "staff");
  await sendStageAlerts(admin, overdueOwner, () => adminIds, "owner");

  return NextResponse.json({
    tracked: tracked.length,
    alertedStaff: overdueStaff.length,
    alertedOwner: overdueOwner.length,
  });
}
