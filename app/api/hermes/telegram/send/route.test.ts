import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const sendTelegramMessageMock = vi.fn();
vi.mock("@/lib/telegram-send", async () => {
  const actual = await vi.importActual<typeof import("@/lib/telegram-send")>("@/lib/telegram-send");
  return {
    ...actual,
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessageMock(...args),
  };
});

const recordAgentEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/hermes/agent-events", () => ({
  recordAgentEvent: (...args: unknown[]) => recordAgentEventMock(...args),
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

import { POST } from "./route";
import { TelegramSendError } from "@/lib/telegram-send";

const TEST_KEY = "test-local-hermes-key-do-not-use-in-prod-1234567890";

function makeRequest(authorization: string | null, body: unknown): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) },
    json: async () => body,
  } as unknown as NextRequest;
}

function stubProfile(profile: { telegram_chat_id: string | null } | null) {
  fromMock.mockReset().mockReturnValue({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: profile, error: profile ? null : { message: "not found" } }) }) }),
  });
}

describe("POST /api/hermes/telegram/send", () => {
  const originalKey = process.env.HERMES_API_KEY;
  const VALID_BODY = { profile_id: "profile-1", text: "You have an overdue lead." };

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
    sendTelegramMessageMock.mockReset().mockResolvedValue(undefined);
    recordAgentEventMock.mockClear();
    stubProfile({ telegram_chat_id: "chat-1" });
  });

  afterEach(() => {
    process.env.HERMES_API_KEY = originalKey;
  });

  it("returns 404 when HERMES_API_KEY is not configured", async () => {
    delete process.env.HERMES_API_KEY;
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));
    expect(response.status).toBe(404);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await POST(makeRequest(null, VALID_BODY))).status).toBe(404);
    expect((await POST(makeRequest("Bearer wrong-key", VALID_BODY))).status).toBe(404);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects a missing profile_id or text", async () => {
    expect((await POST(makeRequest(`Bearer ${TEST_KEY}`, { text: "hi" }))).status).toBe(400);
    expect((await POST(makeRequest(`Bearer ${TEST_KEY}`, { profile_id: "p1" }))).status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the profile doesn't exist", async () => {
    stubProfile(null);
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));
    expect(response.status).toBe(404);
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the profile hasn't linked a Telegram chat yet", async () => {
    stubProfile({ telegram_chat_id: null });
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));
    expect(response.status).toBe(404);
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  it("sends the message and logs a privacy-safe agent_event -- never the message text", async () => {
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(sendTelegramMessageMock).toHaveBeenCalledWith("chat-1", VALID_BODY.text);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent).toMatchObject({ eventType: "send", toolName: "telegram.send" });
    expect(JSON.stringify(loggedEvent)).not.toContain(VALID_BODY.text);
  });

  it("returns 502 and logs a failure event when Telegram rejects the send", async () => {
    sendTelegramMessageMock.mockRejectedValue(new TelegramSendError("telegram_api_error", "chat not found"));

    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));

    expect(response.status).toBe(502);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent.metadata).toMatchObject({ failed: true });
  });
});
