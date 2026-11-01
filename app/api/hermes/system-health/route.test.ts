import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const getSystemHealthMock = vi.fn();
vi.mock("@/lib/hermes/system-health", () => ({
  getSystemHealth: (...args: unknown[]) => getSystemHealthMock(...args),
}));

const recordAgentEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/hermes/agent-events", () => ({
  recordAgentEvent: (...args: unknown[]) => recordAgentEventMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ marker: "admin-client" }),
}));

import { GET } from "./route";

const TEST_KEY = "test-local-hermes-key-do-not-use-in-prod-1234567890";

function makeRequest(authorization: string | null): NextRequest {
  return { headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) } } as unknown as NextRequest;
}

describe("GET /api/hermes/system-health", () => {
  const originalKey = process.env.HERMES_API_KEY;

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
    getSystemHealthMock.mockReset().mockResolvedValue({ lastInboundMessageAt: null, minutesSinceLastInbound: null, webhookSilent: false });
    recordAgentEventMock.mockClear();
  });

  afterEach(() => {
    process.env.HERMES_API_KEY = originalKey;
  });

  it("returns 404 when HERMES_API_KEY is not configured", async () => {
    delete process.env.HERMES_API_KEY;
    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));
    expect(response.status).toBe(404);
    expect(getSystemHealthMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await GET(makeRequest(null))).status).toBe(404);
    expect((await GET(makeRequest("Bearer wrong-key"))).status).toBe(404);
    expect(getSystemHealthMock).not.toHaveBeenCalled();
  });

  it("returns the health result and logs a healthy agent_event", async () => {
    const health = { lastInboundMessageAt: "2026-10-31T05:00:00.000Z", minutesSinceLastInbound: 30, webhookSilent: false };
    getSystemHealthMock.mockResolvedValue(health);

    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(health);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent).toMatchObject({ eventType: "read", toolName: "system-health", summary: "Webhook healthy." });
  });

  it("logs a silent-webhook summary when flagged", async () => {
    getSystemHealthMock.mockResolvedValue({ lastInboundMessageAt: "2026-10-31T02:00:00.000Z", minutesSinceLastInbound: 210, webhookSilent: true });

    await GET(makeRequest(`Bearer ${TEST_KEY}`));

    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent.summary).toBe("Webhook silent for 210 min.");
  });
});
