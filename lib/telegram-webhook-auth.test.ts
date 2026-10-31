import { describe, expect, it } from "vitest";
import { isValidTelegramWebhookSecret } from "@/lib/telegram-webhook-auth";

const SECRET = "a".repeat(32);

describe("isValidTelegramWebhookSecret", () => {
  it("accepts the correct secret, no prefix (not Telegram's convention)", () => {
    expect(isValidTelegramWebhookSecret(SECRET, SECRET)).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(isValidTelegramWebhookSecret("b".repeat(32), SECRET)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isValidTelegramWebhookSecret(null, SECRET)).toBe(false);
  });

  it("rejects when no secret is configured", () => {
    expect(isValidTelegramWebhookSecret(SECRET, undefined)).toBe(false);
  });

  it("rejects a different-length candidate without throwing", () => {
    expect(isValidTelegramWebhookSecret("short", SECRET)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(isValidTelegramWebhookSecret("", SECRET)).toBe(false);
  });
});
