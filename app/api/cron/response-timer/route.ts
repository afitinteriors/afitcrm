import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidCronSecret } from "@/lib/cron-auth";
import { isBusinessHours } from "@/lib/business-time";
import { BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR } from "@/lib/constants";
import { bucketByOverdue, findUnrespondedLeads } from "@/lib/rules/response-timer";
import { sendResponseAlerts } from "@/lib/rules/response-alerts";

// Needs the Node.js runtime for node:crypto (timing-safe secret comparison,
// same as the WABIS webhook route).
export const runtime = "nodejs";

// R-LEAD-003 (docs/BLUEPRINT_V1.md Section 8), Blueprint V1 Phase 4 --
// invoked every 5 minutes by Vercel Cron (vercel.json). Vercel sends
// `Authorization: Bearer <CRON_SECRET>` automatically; a missing/wrong
// secret gets a plain 404 (same "don't tell a prober whether the route
// exists" reasoning as the WABIS webhook) rather than 401/403.
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

  // "Business hours default to 9:00 to 20:00 IST; timers pause outside
  // them" (Section 8). This is a simplified version of that: it does not
  // track elapsed business-minutes while paused, it just skips sending any
  // alert outside the window -- a lead that arrives at 22:00 is alerted
  // promptly once business hours resume at 9:00, rather than being treated
  // as already "15 minutes overdue" at that instant. Known simplification,
  // not the full pause/resume timer the blueprint describes.
  if (!isBusinessHours(now, BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR)) {
    return NextResponse.json({ skipped: "outside business hours" });
  }

  const admin = createAdminClient();

  const unresponded = await findUnrespondedLeads(admin, now);
  const { overdueStaff, overdueOwner } = bucketByOverdue(unresponded, now);

  const { data: adminProfiles } = await admin.from("profiles").select("id").eq("role", "admin").eq("active", true);
  const adminIds = (adminProfiles ?? []).map((p) => p.id);

  await sendResponseAlerts(admin, overdueStaff, (lead) => (lead.assigned_to_id ? [lead.assigned_to_id] : adminIds), "staff");
  await sendResponseAlerts(admin, overdueOwner, () => adminIds, "owner");

  return NextResponse.json({
    checked: unresponded.length,
    alertedStaff: overdueStaff.length,
    alertedOwner: overdueOwner.length,
  });
}
