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

  // Temporary diagnostic capture (structure-only) added to determine the
  // real WABIS payload shape after two production deliveries both returned
  // 400 with no logged detail. These tests pin its two safety properties and
  // confirm it doesn't change existing request-handling behavior.
  describe("temporary diagnostic logging", () => {
    it("logs field names and JS types only -- never the actual field values", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await POST(makeRequest(VALID_PAYLOAD), { params: Promise.resolve({ secret: TEST_SECRET }) });

      const allLoggedText = logSpy.mock.calls.flat().map(String).join("\n");
      // None of the actual values from VALID_PAYLOAD may appear anywhere in the logs.
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.first_name);
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.chat_id);
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.postbackid);
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.user_message);
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.whatsapp_bot_username);
      // Field names and value types are expected to appear.
      expect(allLoggedText).toContain("chat_id");
      expect(allLoggedText).toContain("postbackid");
      expect(allLoggedText).toContain("whatsapp_bot_username");
      expect(allLoggedText).toContain('"string"');

      logSpy.mockRestore();
    });

    it("cannot leak values even for unexpected extra fields or nested data", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const payloadWithExtras = {
        ...VALID_PAYLOAD,
        surprise_phone: "919999999999",
        nested: { secret_note: "do not leak this" },
        a_list: ["do not leak this either"],
      };

      await POST(makeRequest(payloadWithExtras), { params: Promise.resolve({ secret: TEST_SECRET }) });

      const allLoggedText = logSpy.mock.calls.flat().map(String).join("\n");
      expect(allLoggedText).not.toContain("919999999999");
      expect(allLoggedText).not.toContain("do not leak this");
      expect(allLoggedText).not.toContain("do not leak this either");
      // The unexpected keys' names are still fine to observe.
      expect(allLoggedText).toContain("surprise_phone");
      expect(allLoggedText).toContain("nested");
      expect(allLoggedText).toContain("a_list");

      logSpy.mockRestore();
    });

    it("marks a missing required field as absent rather than a type", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await POST(makeRequest({ user_message: "hi, no identity fields here" }), {
        params: Promise.resolve({ secret: TEST_SECRET }),
      });

      const allLoggedText = logSpy.mock.calls.flat().map(String).join("\n");
      expect(allLoggedText).toContain("missing");

      logSpy.mockRestore();
    });

    it("existing malformed-payload behavior is unchanged: still 400, still never ingests", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const response = await POST(
        makeRequest({ user_message: "hi, no chat_id/postbackid/whatsapp_bot_username here" }),
        { params: Promise.resolve({ secret: TEST_SECRET }) }
      );

      expect(response.status).toBe(400);
      expect(ingestInboundMessageMock).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it("existing valid-payload behavior is unchanged: still 200, still ingests once", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const response = await POST(makeRequest(VALID_PAYLOAD), {
        params: Promise.resolve({ secret: TEST_SECRET }),
      });

      expect(response.status).toBe(200);
      expect(ingestInboundMessageMock).toHaveBeenCalledTimes(1);

      logSpy.mockRestore();
    });
  });

  // Narrower follow-up diagnostic: describeShape() alone can't distinguish an
  // empty string from a non-empty one (both are JS type "string"), so a real
  // WABIS delivery showed all-strings-present yet still failed
  // parseWabisMessage()'s isNonEmptyString (length > 0) check with no way to
  // tell why. These tests pin that the added length classification never
  // leaks the actual string content -- only a category and a numeric count.
  describe("temporary identity-field length diagnostic", () => {
    it("classifies a non-empty identity field as non-empty-string with its length, never its content", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await POST(makeRequest(VALID_PAYLOAD), { params: Promise.resolve({ secret: TEST_SECRET }) });

      const allLoggedText = logSpy.mock.calls.flat().map(String).join("\n");
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.chat_id);
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.postbackid);
      expect(allLoggedText).not.toContain(VALID_PAYLOAD.whatsapp_bot_username);
      expect(allLoggedText).toContain("non-empty-string");
      // VALID_PAYLOAD.chat_id is "919000000000" -- 12 characters.
      expect(allLoggedText).toContain(`"length":${VALID_PAYLOAD.chat_id.length}`);

      logSpy.mockRestore();
    });

    it("classifies an empty-string identity field distinctly from a missing or non-string one", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await POST(
        makeRequest({
          first_name: VALID_PAYLOAD.first_name,
          user_input_data: VALID_PAYLOAD.user_input_data,
          user_message: VALID_PAYLOAD.user_message,
          chat_id: "", // empty-string
          postbackid: 12345, // not-a-string
          // whatsapp_bot_username omitted entirely -- missing
        }),
        { params: Promise.resolve({ secret: TEST_SECRET }) }
      );

      const allLoggedText = logSpy.mock.calls.flat().map(String).join("\n");
      expect(allLoggedText).toContain('"chat_id":"empty-string"');
      expect(allLoggedText).toContain('"postbackid":"not-a-string"');
      expect(allLoggedText).toContain('"whatsapp_bot_username":"missing"');
      // No stray digits from the not-a-string numeric value, and no length
      // leaked for the empty/missing/wrong-type cases (only real non-empty
      // strings get a "length" field at all).
      expect(allLoggedText).not.toContain("12345");

      logSpy.mockRestore();
    });

    it("existing malformed-payload behavior is still unchanged with the new diagnostic present", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const response = await POST(makeRequest({ ...VALID_PAYLOAD, chat_id: "" }), {
        params: Promise.resolve({ secret: TEST_SECRET }),
      });

      expect(response.status).toBe(400);
      expect(ingestInboundMessageMock).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });
});
