import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

// Targets only the legacy-webhook disable switch: when the env flag is on,
// POST must return 503 without reading the body or touching Supabase/ingest;
// when it's off (or any other value), existing behavior is unchanged; GET
// (Meta's verification handshake) is never affected.
const ingestInboundMessageMock = vi.fn().mockResolvedValue({ status: "ingested" });
vi.mock("@/lib/whatsapp/ingest", () => ({
  ingestInboundMessage: (...args: unknown[]) => ingestInboundMessageMock(...args),
}));

const createAdminClientMock = vi.fn(() => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClientMock(),
}));

import { GET, POST } from "./route";

// Local test-only values -- never real credentials.
const TEST_APP_SECRET = "test-local-app-secret-not-real";
const TEST_VERIFY_TOKEN = "test-local-verify-token-not-real";

function makePostRequest(bodyText: string, signature: string | null) {
  const text = vi.fn().mockResolvedValue(bodyText);
  const request = {
    text,
    headers: { get: (name: string) => (name.toLowerCase() === "x-hub-signature-256" ? signature : null) },
  } as unknown as NextRequest;
  return { request, text };
}

function makeGetRequest(query: Record<string, string>): NextRequest {
  return { nextUrl: { searchParams: new URLSearchParams(query) } } as unknown as NextRequest;
}

beforeEach(() => {
  vi.stubEnv("WHATSAPP_APP_SECRET", TEST_APP_SECRET);
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", TEST_VERIFY_TOKEN);
  ingestInboundMessageMock.mockClear();
  createAdminClientMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/webhooks/whatsapp -- legacy disable switch", () => {
  it("returns 503 and processes nothing when WHATSAPP_LEGACY_WEBHOOK_DISABLED is 'true'", async () => {
    vi.stubEnv("WHATSAPP_LEGACY_WEBHOOK_DISABLED", "true");
    const { request, text } = makePostRequest("{}", "sha256=deadbeef");

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(text).not.toHaveBeenCalled();
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(ingestInboundMessageMock).not.toHaveBeenCalled();
  });

  it("keeps existing behavior (401 on a bad signature) when the flag is unset", async () => {
    const { request, text } = makePostRequest("{}", "sha256=deadbeef");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(text).toHaveBeenCalledTimes(1);
    expect(ingestInboundMessageMock).not.toHaveBeenCalled();
  });

  it("does not disable for any value other than exactly 'true'", async () => {
    for (const value of ["false", "1", "TRUE", ""]) {
      vi.stubEnv("WHATSAPP_LEGACY_WEBHOOK_DISABLED", value);
      const { request } = makePostRequest("{}", "sha256=deadbeef");
      const response = await POST(request);
      expect(response.status).toBe(401);
    }
  });
});

describe("GET /api/webhooks/whatsapp -- verification handshake unaffected", () => {
  it("still answers Meta's handshake while POST is disabled", async () => {
    vi.stubEnv("WHATSAPP_LEGACY_WEBHOOK_DISABLED", "true");

    const response = await GET(
      makeGetRequest({ "hub.mode": "subscribe", "hub.verify_token": TEST_VERIFY_TOKEN, "hub.challenge": "abc123" })
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });
});
