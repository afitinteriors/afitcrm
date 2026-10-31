import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTelegramWebhookSecret } from "@/lib/telegram-webhook-auth";
import { parseTelegramUpdate, linkTelegramChat } from "@/lib/telegram-chat-link";

export const runtime = "nodejs";

// Blueprint V1 Section 9, Phase 5: "Each member's Telegram username is
// stored in their CRM profile" -- but a bot can't message a user by
// @username alone; it needs their chat_id, which only exists once they've
// messaged the bot. This is that one-time linking step: a staff member
// sends the bot anything (e.g. /start), this route matches them by
// telegram_username and records their chat_id.
//
// Always 200s (even on a secret mismatch or no match) -- Telegram retries
// aggressively on non-2xx responses, which would just hammer this route for
// a condition that will never resolve (a stranger messaging the bot, a
// configuration error). The secret check still gates whether any work
// happens; it just never surfaces as a different HTTP status.
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expectedSecret || !isValidTelegramWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"), expectedSecret)) {
    return NextResponse.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const update = parseTelegramUpdate(payload);
  if (!update) {
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  await linkTelegramChat(admin, update);

  return NextResponse.json({ ok: true });
}
