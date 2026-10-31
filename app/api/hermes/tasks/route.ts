import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import { recordAgentEvent, privacySafeLeadReference } from "@/lib/hermes/agent-events";
import { FOLLOW_UP_TYPES } from "@/lib/constants";
import type { FollowUpInsert, FollowUpType } from "@/lib/supabase/types";

export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5: "Create tasks and reminders" is one of
// the few write tools Hermes is given (the full list: create tasks/
// reminders, send Telegram messages, write reports, create bug tickets --
// Section 9's "Tools Hermes never gets" explicitly excludes price/discount/
// stage/payment/settings writes, deletes, and customer messages). This is
// that tool, scoped to exactly "create a follow_up row" -- nothing else.
export async function POST(request: NextRequest) {
  const expectedKey = process.env.HERMES_API_KEY;
  if (!expectedKey) {
    console.error("HERMES_API_KEY is not set; rejecting Hermes tool request.");
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isValidHermesApiKey(request.headers.get("authorization"), expectedKey)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const leadId = typeof input.lead_id === "string" ? input.lead_id : null;
  const dueDate = typeof input.due_date === "string" ? input.due_date : null;
  if (!leadId || !dueDate) {
    return NextResponse.json({ error: "lead_id and due_date are required." }, { status: 400 });
  }

  const type = isFollowUpType(input.type) ? input.type : "follow_up";
  const dueTime = typeof input.due_time === "string" ? input.due_time : null;
  const notes = typeof input.notes === "string" ? input.notes : null;
  const assignedToId = typeof input.assigned_to_id === "string" ? input.assigned_to_id : null;

  const admin = createAdminClient();

  const { data: lead, error: leadError } = await admin
    .from("leads")
    .select("id, location, service_required, project_type")
    .eq("id", leadId)
    .single();
  if (leadError || !lead) {
    return NextResponse.json({ error: "No lead found for lead_id." }, { status: 404 });
  }

  const insert: FollowUpInsert = {
    lead_id: leadId,
    due_date: dueDate,
    due_time: dueTime,
    type,
    notes,
    assigned_to_id: assignedToId,
  };
  const { data: created, error } = await admin.from("follow_ups").insert(insert).select("id").single();
  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to create follow-up." }, { status: 500 });
  }

  await recordAgentEvent(admin, {
    eventType: "create",
    toolName: "tasks.create",
    summary: `Created a ${type} task for ${privacySafeLeadReference(lead)}, due ${dueDate}.`,
    metadata: { followUpId: created.id, dueDate, type },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

function isFollowUpType(value: unknown): value is FollowUpType {
  return typeof value === "string" && (FOLLOW_UP_TYPES as string[]).includes(value);
}
