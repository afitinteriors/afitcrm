import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const createBugTicketMock = vi.fn();
vi.mock("@/lib/github-bug-ticket", async () => {
  const actual = await vi.importActual<typeof import("@/lib/github-bug-ticket")>("@/lib/github-bug-ticket");
  return {
    ...actual,
    createBugTicket: (...args: unknown[]) => createBugTicketMock(...args),
  };
});

const recordAgentEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/hermes/agent-events", () => ({
  recordAgentEvent: (...args: unknown[]) => recordAgentEventMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ marker: "admin-client" }),
}));

import { POST } from "./route";
import { GitHubBugTicketError } from "@/lib/github-bug-ticket";

const TEST_KEY = "test-local-hermes-key-do-not-use-in-prod-1234567890";

function makeRequest(authorization: string | null, body: unknown): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) },
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/hermes/bug-ticket", () => {
  const originalKey = process.env.HERMES_API_KEY;
  const VALID_BODY = { title: "Webhook silent", body: "No inbound messages for 3 hours." };

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
    createBugTicketMock.mockReset().mockResolvedValue({ number: 42, htmlUrl: "https://github.com/afitinteriors/afitcrm/issues/42" });
    recordAgentEventMock.mockClear();
  });

  afterEach(() => {
    process.env.HERMES_API_KEY = originalKey;
  });

  it("returns 404 when HERMES_API_KEY is not configured", async () => {
    delete process.env.HERMES_API_KEY;
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));
    expect(response.status).toBe(404);
    expect(createBugTicketMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await POST(makeRequest(null, VALID_BODY))).status).toBe(404);
    expect((await POST(makeRequest("Bearer wrong-key", VALID_BODY))).status).toBe(404);
    expect(createBugTicketMock).not.toHaveBeenCalled();
  });

  it("rejects a missing title or body", async () => {
    expect((await POST(makeRequest(`Bearer ${TEST_KEY}`, { body: "y" }))).status).toBe(400);
    expect((await POST(makeRequest(`Bearer ${TEST_KEY}`, { title: "x" }))).status).toBe(400);
    expect(createBugTicketMock).not.toHaveBeenCalled();
  });

  it("creates the ticket and logs an agent_event", async () => {
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ number: 42, htmlUrl: "https://github.com/afitinteriors/afitcrm/issues/42" });
    expect(createBugTicketMock).toHaveBeenCalledWith(VALID_BODY.title, VALID_BODY.body);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent).toMatchObject({ eventType: "create", toolName: "bug-ticket.create" });
  });

  it("returns 502 and logs a failure event when GitHub rejects the request", async () => {
    createBugTicketMock.mockRejectedValue(new GitHubBugTicketError("github_api_error", "Bad credentials"));

    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`, VALID_BODY));

    expect(response.status).toBe(502);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent.metadata).toMatchObject({ failed: true });
  });
});
