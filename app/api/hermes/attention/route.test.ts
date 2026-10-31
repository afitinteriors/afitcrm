import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const getAttentionItemsMock = vi.fn();
vi.mock("@/lib/hermes/attention", () => ({
  getAttentionItems: (...args: unknown[]) => getAttentionItemsMock(...args),
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

describe("GET /api/hermes/attention", () => {
  const originalKey = process.env.HERMES_API_KEY;

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
    getAttentionItemsMock.mockReset().mockResolvedValue([]);
    recordAgentEventMock.mockClear();
  });

  afterEach(() => {
    process.env.HERMES_API_KEY = originalKey;
  });

  it("returns 404 when HERMES_API_KEY is not configured", async () => {
    delete process.env.HERMES_API_KEY;
    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));
    expect(response.status).toBe(404);
    expect(getAttentionItemsMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await GET(makeRequest(null))).status).toBe(404);
    expect((await GET(makeRequest("Bearer wrong-key"))).status).toBe(404);
    expect(getAttentionItemsMock).not.toHaveBeenCalled();
  });

  it("returns the items from getAttentionItems and logs an agent_event", async () => {
    const items = [{ reference: "Lead ABC12345 — Kollam — Gypsum", crmUrl: "/leads/abc", reasonKind: "unresponded", assignedToId: "staff-1" }];
    getAttentionItemsMock.mockResolvedValue(items);

    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items });
    expect(recordAgentEventMock).toHaveBeenCalledTimes(1);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent).toMatchObject({ eventType: "read", toolName: "attention" });
    expect(loggedEvent.summary).toContain("1");
  });

  it("never includes phone/name in the logged event -- only the already privacy-safe items' count", async () => {
    getAttentionItemsMock.mockResolvedValue([
      { reference: "Lead X — Y — Z", crmUrl: "/leads/x", reasonKind: "stage_overdue", assignedToId: null },
    ]);

    await GET(makeRequest(`Bearer ${TEST_KEY}`));

    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(JSON.stringify(loggedEvent)).not.toMatch(/phone|customer_name/i);
  });
});
