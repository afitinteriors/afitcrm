import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidHermesApiKey } from "@/lib/hermes-auth";
import { sendTelegramMessage, TelegramSendError } from "@/lib/telegram-send";
import { recordAgentEvent } from "@/lib/hermes/agent-events";

export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5: "Send Telegram messages to team
// members." Takes a profile id, not a raw chat_id -- Hermes should never
// need to know Telegram internals, just who to message. 404s (not a typed
// error) when that profile has no telegram_chat_id yet: they haven't
// messaged the bot to link their account (app/api/webhooks/telegram), so
// there is nowhere to send to.
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
  const profileId = typeof input.profile_id === "string" ? input.profile_id : null;
  const text = typeof input.text === "string" ? input.text : null;
  if (!profileId || !text) {
    return NextResponse.json({ error: "profile_id and text are required." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin.from("profiles").select("id, telegram_chat_id").eq("id", profileId).single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "No profile found for profile_id." }, { status: 404 });
  }
  if (!profile.telegram_chat_id) {
    return NextResponse.json({ error: "This profile has not linked a Telegram chat yet." }, { status: 404 });
  }

  try {
    await sendTelegramMessage(profile.telegram_chat_id, text);
  } catch (err) {
    const message = err instanceof TelegramSendError ? err.message : "Failed to send the Telegram message.";
    await recordAgentEvent(admin, {
      eventType: "send",
      toolName: "telegram.send",
      summary: `Failed to send a Telegram message to profile ${profileId}: ${message}`,
      metadata: { profileId, textLength: text.length, failed: true },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Privacy-safe by construction (Section 9): logs that a message was sent
  // and how long it was, never the message text itself -- Hermes composes
  // the text, which may reference a lead by its own privacy-safe reference,
  // but this log has no way to know that and shouldn't assume it.
  await recordAgentEvent(admin, {
    eventType: "send",
    toolName: "telegram.send",
    summary: `Sent a Telegram message to profile ${profileId}.`,
    metadata: { profileId, textLength: text.length },
  });

  return NextResponse.json({ sent: true });
}
