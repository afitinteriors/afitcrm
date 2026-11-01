import "server-only";

// Blueprint V1 Section 9, Phase 5: "Send Telegram messages to team members"
// -- one of the few tools Hermes is given (Section 9's "Tools Hermes never
// gets" explicitly excludes sending messages to CUSTOMERS; staff is fine).
// Same shape as lib/whatsapp/send-message.ts's sendTextMessage: a typed
// error class, a guard clause on the missing-token case that throws before
// any network call -- TELEGRAM_BOT_TOKEN is forced empty in
// .env.development.local specifically so this guard is what local dev
// hits, never a real send to a real staff member.

export type TelegramSendErrorCode = "not_configured" | "telegram_api_error";

export class TelegramSendError extends Error {
  code: TelegramSendErrorCode;
  constructor(code: TelegramSendErrorCode, message: string) {
    super(message);
    this.name = "TelegramSendError";
    this.code = code;
  }
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new TelegramSendError("not_configured", "TELEGRAM_BOT_TOKEN is not configured.");
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!response.ok) {
    let description = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { description?: string };
      if (body.description) description = body.description;
    } catch {
      // Telegram's error body is always JSON in practice; a non-JSON
      // response just falls back to the HTTP status above.
    }
    throw new TelegramSendError("telegram_api_error", `Telegram did not accept this message: ${description}`);
  }
}
