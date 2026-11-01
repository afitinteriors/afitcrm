import "server-only";
import { timingSafeEqual } from "node:crypto";

// Telegram's own webhook security mechanism (not HMAC like Meta): the
// secret_token passed to setWebhook is echoed back on every update POST as
// the X-Telegram-Bot-Api-Secret-Token header, verbatim, for a constant-time
// exact-match check -- same reasoning as lib/cron-auth.ts's
// isValidCronSecret, just no "Bearer " prefix since that's not Telegram's
// convention.
export function isValidTelegramWebhookSecret(headerValue: string | null, expected: string | undefined): boolean {
  if (!expected || !headerValue) return false;

  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
