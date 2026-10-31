import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const queryLeadsMock = vi.fn();
vi.mock("@/lib/hermes/leads-query", () => ({
  queryLeads: (...args: unknown[]) => queryLeadsMock(...args),
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

function makeRequest(authorization: string | null, url = "http://localhost/api/hermes/leads"): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) },
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

describe("GET /api/hermes/leads", () => {
  const originalKey = process.env.HERMES_API_KEY;

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
    queryLeadsMock.mockReset().mockResolvedValue([]);
    recordAgentEventMock.mockClear();
  });

  afterEach(() => {
    process.env.HERMES_API_KEY = originalKey;
  });

  it("returns 404 when HERMES_API_KEY is not configured", async () => {
    delete process.env.HERMES_API_KEY;
    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));
    expect(response.status).toBe(404);
    expect(queryLeadsMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await GET(makeRequest(null))).status).toBe(404);
    expect((await GET(makeRequest("Bearer wrong-key"))).status).toBe(404);
    expect(queryLeadsMock).not.toHaveBeenCalled();
  });

  it("passes query params through as filters", async () => {
    await GET(makeRequest(`Bearer ${TEST_KEY}`, "http://localhost/api/hermes/leads?location=Kollam&status=won&datePreset=last7"));
    expect(queryLeadsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ location: "Kollam", status: "won", datePreset: "last7" }),
    );
  });

  it("returns the items and logs a privacy-safe agent_event", async () => {
    const items = [{ reference: "Lead ABC — Kollam — Gypsum", crmUrl: "/leads/abc", status: "won", assignedToId: "s1", createdAt: "2026-10-31T06:00:00.000Z" }];
    queryLeadsMock.mockResolvedValue(items);

    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items });
    expect(recordAgentEventMock).toHaveBeenCalledTimes(1);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent).toMatchObject({ eventType: "read", toolName: "leads.query" });
    expect(JSON.stringify(loggedEvent)).not.toMatch(/phone|customer_name/i);
  });
});
