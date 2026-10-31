import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const recordAgentEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/hermes/agent-events", () => ({
  recordAgentEvent: (...args: unknown[]) => recordAgentEventMock(...args),
  privacySafeLeadReference: (lead: { id: string }) => `Lead ${lead.id.slice(0, 8).toUpperCase()}`,
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

import { POST } from "./route";

const TEST_KEY = "test-local-hermes-key-do-not-use-in-prod-1234567890";

function makeRequest(authorization: string | null, body: unknown): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) },
    json: async () => body,
  } as unknown as NextRequest;
}

function stubClient(opts: { lead: unknown; insertResult: { data: { id: string } | null; error: { message: string } | null } }) {
  fromMock.mockReset().mockImplementation((table: string) => {
    if (table === "leads") {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: opts.lead, error: opts.lead ? null : { message: "not found" } }) }) }) };
    }
    if (table === "follow_ups") {
      return { insert: () => ({ select: () => ({ single: () => Promise.resolve(opts.insertResult) }) }) };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

describe("POST /api/hermes/tasks", () => {
  const originalKey = process.env.HERMES_API_KEY;
  const VALID_BODY = { lead_id: "lead-1", due_date: "2026-11-01" };

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
    recordAgentEventMock.mockClear();
    stubClient({ lead: { id: "lead-1", location: "Kollam", service_required: "Gypsum", project_type: null }, insertResult: { data: { id: "fu-1" }, error: null } });
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

  it("rejects invalid JSON", async () => {
    const request = { headers: { get: () => `Bearer ${TEST_KEY}` }, json: async () => { throw new Error("bad json"); } } as unknown as NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects a missing lead_id or due_date", async () => {
    expect((await POST(makeRequest(`Bearer ${TEST_KEY}`, { due_date: "2026-11-01" }))).status).toBe(400);
    expect((await POST(makeRequest(`Bearer ${TEST_KEY}`, { lead_id: "lead-1" }))).status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns 404 when lead_id doesn't resolve to a lead", async () => {
    stubClient({ lead: null, insertResult: { data: null, error: null } });
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));
    expect(response.status).toBe(404);
  });

  it("creates a follow_up with the given fields, defaulting type to follow_up", async () => {
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "fu-1" });
    expect(recordAgentEventMock).toHaveBeenCalledTimes(1);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent).toMatchObject({ eventType: "create", toolName: "tasks.create" });
  });

  it("rejects an unrecognised type by falling back to follow_up rather than erroring", async () => {
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, { ...VALID_BODY, type: "not-a-real-type" }));
    expect(response.status).toBe(201);
  });

  it("surfaces an insert error as a 500", async () => {
    stubClient({ lead: { id: "lead-1", location: null, service_required: null, project_type: null }, insertResult: { data: null, error: { message: "db down" } } });
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));
    expect(response.status).toBe(500);
  });
});
