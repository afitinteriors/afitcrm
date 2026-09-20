import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryResult = { data?: unknown; count?: number | null; error?: { code?: string; message?: string } | null };

// Chainable/thenable Supabase query stand-in (same idea as the other action
// tests) that also records every method call so tests can assert *what* was
// written, not just that a write happened.
function makeBuilder(result: QueryResult) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = { calls };
  for (const method of ["select", "eq", "is", "insert", "update", "delete"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    });
  }
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder as Record<string, unknown> & { calls: Array<[string, unknown[]]> };
}

function createFake(script: QueryResult[]) {
  const builders: ReturnType<typeof makeBuilder>[] = [];
  const from = vi.fn(() => {
    const b = makeBuilder(script[builders.length] ?? { data: null, error: null });
    builders.push(b);
    return b;
  });
  return { client: { from }, builders, from };
}

let userClient: ReturnType<typeof createFake>;
let adminClient: ReturnType<typeof createFake>;
vi.mock("@/lib/supabase/server", () => ({ createClient: () => userClient.client }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => adminClient.client }));

const getCurrentProfileMock = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentProfile: () => getCurrentProfileMock() }));

import { subscribePush, unsubscribePush } from "./push";

const SUB = {
  endpoint: "https://push.example.com/send/abc123",
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
};
const USER = { id: "user-1", role: "staff" as const };

function callsOf(b: ReturnType<typeof makeBuilder>, method: string) {
  return b.calls.filter(([m]) => m === method).map(([, args]) => args);
}

describe("subscribePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(USER);
    adminClient = createFake([]);
  });

  it("rejects an unauthenticated caller and touches nothing", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    userClient = createFake([]);

    expect(await subscribePush(SUB)).toEqual({ error: "Not signed in." });
    expect(userClient.from).not.toHaveBeenCalled();
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("creates a subscription owned by the SESSION user, ignoring any user_id smuggled into the payload", async () => {
    userClient = createFake([{ count: 0, error: null }, { error: null }]);

    const result = await subscribePush({ ...SUB, user_id: "someone-else", userId: "someone-else" }, "Test UA");

    expect(result).toEqual({ ok: true });
    const [inserted] = callsOf(userClient.builders[1], "insert")[0] as [Record<string, unknown>];
    expect(inserted).toMatchObject({
      user_id: "user-1",
      endpoint: SUB.endpoint,
      p256dh: SUB.keys.p256dh,
      auth: SUB.keys.auth,
      user_agent: "Test UA",
      revoked_at: null,
    });
    expect(JSON.stringify(inserted)).not.toContain("someone-else");
    expect(adminClient.from).not.toHaveBeenCalled();
  });

  it("rejects malformed subscriptions before any database call", async () => {
    userClient = createFake([]);
    const bad = [
      null,
      "string",
      {},
      { endpoint: "http://insecure.example/x", keys: SUB.keys },
      { endpoint: "not a url", keys: SUB.keys },
      { endpoint: SUB.endpoint },
      { endpoint: SUB.endpoint, keys: { p256dh: "***", auth: SUB.keys.auth } },
      { endpoint: SUB.endpoint, keys: { p256dh: SUB.keys.p256dh, auth: "" } },
    ];
    for (const input of bad) {
      expect(await subscribePush(input)).toEqual({ error: "Invalid push subscription." });
    }
    expect(userClient.from).not.toHaveBeenCalled();
  });

  it("refuses to add a device beyond the per-user cap", async () => {
    userClient = createFake([{ count: 10, error: null }]);

    expect(await subscribePush(SUB)).toEqual({ error: "Too many devices are already enabled. Turn one off first." });
    expect(userClient.builders).toHaveLength(1); // count only, no insert
  });

  it("duplicate endpoint: re-points the existing row to the session user via the service-role client", async () => {
    userClient = createFake([{ count: 0, error: null }, { error: { code: "23505" } }]);
    adminClient = createFake([{ error: null }]);

    expect(await subscribePush(SUB, "UA")).toEqual({ ok: true });

    const [patch] = callsOf(adminClient.builders[0], "update")[0] as [Record<string, unknown>];
    expect(patch).toMatchObject({ user_id: "user-1", revoked_at: null, last_success_at: null, endpoint: SUB.endpoint });
    expect(callsOf(adminClient.builders[0], "eq")).toEqual([["endpoint", SUB.endpoint]]);
  });

  it("does not fall back to the service-role client for non-duplicate errors, and never leaks the raw error", async () => {
    userClient = createFake([{ count: 0, error: null }, { error: { code: "42501", message: "secret detail" } }]);

    const result = await subscribePush(SUB);

    expect(result).toEqual({ error: "Could not save this device. Try again." });
    expect(JSON.stringify(result)).not.toContain("secret detail");
    expect(adminClient.from).not.toHaveBeenCalled();
  });
});

describe("unsubscribePush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(USER);
  });

  it("rejects an unauthenticated caller", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    userClient = createFake([]);

    expect(await unsubscribePush(SUB.endpoint)).toEqual({ error: "Not signed in." });
    expect(userClient.from).not.toHaveBeenCalled();
  });

  it("revokes only the caller's own row for that endpoint", async () => {
    userClient = createFake([{ error: null }]);

    expect(await unsubscribePush(SUB.endpoint)).toEqual({ ok: true });

    const b = userClient.builders[0];
    const [patch] = callsOf(b, "update")[0] as [Record<string, unknown>];
    expect(typeof patch.revoked_at).toBe("string");
    expect(callsOf(b, "eq")).toEqual([
      ["user_id", "user-1"],
      ["endpoint", SUB.endpoint],
    ]);
  });

  it("rejects a missing or oversized endpoint", async () => {
    userClient = createFake([]);
    expect(await unsubscribePush(undefined)).toEqual({ error: "Invalid push subscription." });
    expect(await unsubscribePush("")).toEqual({ error: "Invalid push subscription." });
    expect(await unsubscribePush("x".repeat(3000))).toEqual({ error: "Invalid push subscription." });
    expect(userClient.from).not.toHaveBeenCalled();
  });
});
