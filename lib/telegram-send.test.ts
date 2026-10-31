import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTelegramMessage, TelegramSendError } from "./telegram-send";

describe("sendTelegramMessage", () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    global.fetch = originalFetch;
  });

  it("throws not_configured before any network call when the token is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;

    await expect(sendTelegramMessage("123", "hi")).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("with a configured token", () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    });

    it("calls Telegram's sendMessage with the chat id and text", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
      global.fetch = fetchMock as never;

      await sendTelegramMessage("chat-1", "Lead ABC123 is overdue");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.telegram.org/bottest-bot-token/sendMessage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ chat_id: "chat-1", text: "Lead ABC123 is overdue" }),
        }),
      );
    });

    it("throws telegram_api_error with Telegram's own description on a non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ description: "chat not found" }) }) as never;

      await expect(sendTelegramMessage("bad-chat", "hi")).rejects.toMatchObject({
        code: "telegram_api_error",
        message: expect.stringContaining("chat not found"),
      });
    });

    it("falls back to the HTTP status when the error body isn't JSON", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        },
      }) as never;

      await expect(sendTelegramMessage("chat-1", "hi")).rejects.toThrow(TelegramSendError);
    });
  });
});
