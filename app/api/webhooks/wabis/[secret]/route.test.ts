import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

// Route-level tests verify authentication and request handling only —
// ingestion itself (lead matching, conversation reuse, message persistence,
// dedup) is already covered directly in lib/whatsapp/ingest.test.ts against
// a fake Supabase client. Mocking both modules here avoids any real
// Supabase/network call and keeps this file targeted at the route's own
// job: secret check, JSON parsing, payload validation, response codes.
const ingestInboundMessageMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/whatsapp/ingest", () => ({
  ingestInboundMessage: (...args: unknown[]) => ingestInboundMessageMock(...args),
}));

const createAdminClientMock = vi.fn(() => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { POST } from "./route";

// Local test-only value — never a real credential, never used outside this
// process, never logged.
const TEST_SECRET = "test-local-secret-do-not-use-in-prod-1234567890";

// Shape verified against ONE real captured delivery (Vercel Preview
// function logs, 8 Sep 2026) from the Gypsum Plaster "Contact Collection"
// WABIS flow.
const VALID_PAYLOAD = {
  first_name: "Test",
  chat_id: "919000000000",
  postbackid: "postback-abc123",
  user_input_data: [] as unknown[],
  user_message: "Hello",
  whatsapp_bot_username: "+91 7356877322",
};

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/webhooks/wabis/[secret]", () => {
  const originalSecret = process.env.WABIS_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.WABIS_WEBHOOK_SECRET = TEST_SECRET;
    ingestInboundMessageMock.mockClear();
    createAdminClientMock.mockClear();
  });

  afterEach(() => {
    process.env.WABIS_WEBHOOK_SECRET = originalSecret;
  });

  it("scenario: valid secret + valid WABIS payload -> ingests and returns 200", async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD), {
      params: Promise.resolve({ secret: TEST_SECRET }),
    });
    expect(response.status).toBe(200);
    expect(ingestInboundMessageMock).toHaveBeenCalledTimes(1);
  });

  it("scenario: invalid secret -> 404, never ingests", async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD), {
      params: Promise.resolve({ secret: "wrong-secret-wrong-secret-wrong12" }),
    });
    expect(response.status).toBe(404);
    expect(ingestInboundMessageMock).not.toHaveBeenCalled();
  });

  it("scenario: missing/invalid route secret (empty path segment) -> 404, never ingests", async () => {
    const response = await POST(makeRequest(VALID_PAYLOAD), { params: Promise.resolve({ secret: "" }) });
    expect(response.status).toBe(404);
    expect(ingestInboundMessageMock).not.toHaveBeenCalled();
  });

  it("scenario: server not configured (WABIS_WEBHOOK_SECRET unset) -> 404, never ingests", async () => {
    delete process.env.WABIS_WEBHOOK_SECRET;
    const response = await POST(makeRequest(VALID_PAYLOAD), {
      params: Promise.resolve({ secret: TEST_SECRET }),
    });
    expect(response.status).toBe(404);
    expect(ingestInboundMessageMock).not.toHaveBeenCalled();
  });

  it("scenario: malformed (non-JSON) body -> 400, never ingests", async () => {
    const badRequest = {
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as NextRequest;

    const response = await POST(badRequest, { params: Promise.resolve({ secret: TEST_SECRET }) });
    expect(response.status).toBe(400);
    expect(ingestInboundMessageMock).not.toHaveBeenCalled();
  });

  it("scenario: malformed payload (missing confirmed identity fields) -> 400, never ingests", async () => {
    const response = await POST(makeRequest({ user_message: "hi, no chat_id/postbackid/whatsapp_bot_username here" }), {
      params: Promise.resolve({ secret: TEST_SECRET }),
    });
    expect(response.status).toBe(400);
    expect(ingestInboundMessageMock).not.toHaveBeenCalled();
  });

  it("scenario: secret is never logged, on a wrong-secret attempt or a valid one", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await POST(makeRequest(VALID_PAYLOAD), {
      params: Promise.resolve({ secret: "guess-1-guess-1-guess-1-guess-12" }),
    });
    await POST(makeRequest(VALID_PAYLOAD), { params: Promise.resolve({ secret: TEST_SECRET }) });

    const allLoggedText = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().map(String).join("\n");
    expect(allLoggedText).not.toContain(TEST_SECRET);
    expect(allLoggedText).not.toContain("guess-1-guess-1-guess-1-guess-12");

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // The temporary structure-only payload diagnostics (shape dump,
  // required-field type summary, identity-field length classification) used
  // to capture the real WABIS payload shape and confirm the empty-postbackid
  // cause of the earlier 400s have been removed now that the parser fix and
  // deterministic dedup key are in place and proven in production -- their
  // job is done. This test guards against ever silently reintroducing
  // payload-value logging on this route.
  it("never logs anything at all (info level) for an ordinary valid delivery", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await POST(makeRequest(VALID_PAYLOAD), { params: Promise.resolve({ secret: TEST_SECRET }) });

    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
