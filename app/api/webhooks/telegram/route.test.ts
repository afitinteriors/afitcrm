import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const parseTelegramUpdateMock = vi.fn();
const linkTelegramChatMock = vi.fn();
vi.mock("@/lib/telegram-chat-link", () => ({
  parseTelegramUpdate: (...args: unknown[]) => parseTelegramUpdateMock(...args),
  linkTelegramChat: (...args: unknown[]) => linkTelegramChatMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ marker: "admin-client" }),
}));

import { POST } from "./route";

const TEST_SECRET = "test-telegram-webhook-secret-do-not-use-in-prod";

function makeRequest(secretHeader: string | null, body: unknown): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "x-telegram-bot-api-secret-token" ? secretHeader : null) },
    json: async () => {
      if (body === "INVALID_JSON") throw new Error("bad json");
      return body;
    },
  } as unknown as NextRequest;
}

describe("POST /api/webhooks/telegram", () => {
  const originalSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = TEST_SECRET;
    parseTelegramUpdateMock.mockReset().mockReturnValue(null);
    linkTelegramChatMock.mockReset().mockResolvedValue(false);
  });

  afterEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = originalSecret;
  });

  it("always 200s, even with no secret configured, and does no work", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const response = await POST(makeRequest(TEST_SECRET, {}));
    expect(response.status).toBe(200);
    expect(linkTelegramChatMock).not.toHaveBeenCalled();
  });

  it("always 200s on a wrong or missing secret, and does no work", async () => {
    expect((await POST(makeRequest("wrong-secret", {}))).status).toBe(200);
    expect((await POST(makeRequest(null, {}))).status).toBe(200);
    expect(linkTelegramChatMock).not.toHaveBeenCalled();
  });

  it("200s on invalid JSON without crashing", async () => {
    const response = await POST(makeRequest(TEST_SECRET, "INVALID_JSON"));
    expect(response.status).toBe(200);
    expect(linkTelegramChatMock).not.toHaveBeenCalled();
  });

  it("200s and does no work when the update doesn't parse (e.g. no username)", async () => {
    parseTelegramUpdateMock.mockReturnValue(null);
    const response = await POST(makeRequest(TEST_SECRET, { message: {} }));
    expect(response.status).toBe(200);
    expect(linkTelegramChatMock).not.toHaveBeenCalled();
  });

  it("links the chat when the update parses, with a valid secret", async () => {
    parseTelegramUpdateMock.mockReturnValue({ chatId: "555", username: "azhar" });

    const response = await POST(makeRequest(TEST_SECRET, { message: { chat: { id: 555 }, from: { username: "azhar" } } }));

    expect(response.status).toBe(200);
    expect(linkTelegramChatMock).toHaveBeenCalledWith(expect.anything(), { chatId: "555", username: "azhar" });
  });
});
