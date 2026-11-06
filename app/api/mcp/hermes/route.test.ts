import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

const TEST_KEY = "test-local-hermes-mcp-key-do-not-use-in-prod-1234567890";

function makeRequest(authorization: string | null): Request {
  return new Request("http://test.local/api/mcp/hermes", {
    method: "POST",
    headers: authorization ? { authorization, "content-type": "application/json" } : { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
}

// Blueprint V1 Section 9: same "don't reveal the route exists" 404-on-
// auth-failure convention as every other Hermes/cron route -- this is the
// one piece of hand-written logic in this route (everything past it is
// the MCP SDK's own transport, already covered by that SDK's own tests).
// Every tool's actual business logic is tested directly in
// lib/hermes/mcp-tools.test.ts.
describe("POST /api/mcp/hermes auth gating", () => {
  const originalKey = process.env.HERMES_API_KEY;

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.HERMES_API_KEY = originalKey;
  });

  it("returns 404 when HERMES_API_KEY is not configured", async () => {
    delete process.env.HERMES_API_KEY;
    const response = await POST(makeRequest(`Bearer ${TEST_KEY}`));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await POST(makeRequest(null))).status).toBe(404);
    expect((await POST(makeRequest("Bearer wrong-key"))).status).toBe(404);
  });
});
