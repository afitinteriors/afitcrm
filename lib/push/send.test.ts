import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

// Recording, thenable Supabase stand-in (same idea as the other tests).
function makeBuilder(table: string, result: QueryResult, log: Call[]) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "insert", "update"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      log.push({ table, method, args });
      return builder;
    });
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}
type Call = { table: string; method: string; args: unknown[] };

let script: Record<string, QueryResult[]> = {};
let log: Call[] = [];
const counters: Record<string, number> = {};
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const idx = counters[table] ?? 0;
      counters[table] = idx + 1;
      return makeBuilder(table, script[table]?.[idx] ?? { data: null, error: null }, log);
    },
  }),
}));

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

import { sendPushToUser } from "./send";

// Synthetic, correctly-shaped keys (87 / 43 base64url chars) -- not real keys.
const PUBLIC_KEY = "B".padEnd(87, "A");
const PRIVATE_KEY = "P".padEnd(43, "Q");

const SUBS = [
  { id: "sub-1", endpoint: "https://push.example.net/1", p256dh: "k1", auth: "a1" },
  { id: "sub-2", endpoint: "https://push.example.net/2", p256dh: "k2", auth: "a2" },
];
const PAYLOAD = { title: "Hello", body: "World", type: "test", route: "/notifications" };
const NOTIF_ID = "11111111-1111-4111-8111-111111111111";

function setScript(s: Record<string, QueryResult[]>) {
  script = s;
  log = [];
  for (const key of Object.keys(counters)) delete counters[key];
}
const updates = (table: string) => log.filter((c) => c.table === table && c.method === "update").map((c) => c.args[0] as Record<string, unknown>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", PUBLIC_KEY);
  vi.stubEnv("VAPID_PRIVATE_KEY", PRIVATE_KEY);
  vi.stubEnv("VAPID_SUBJECT", "mailto:ops@afitbuilders.in");
  sendNotification.mockResolvedValue({ statusCode: 201 });
  setScript({});
});

describe("sendPushToUser -- guards", () => {
  it("rejects an invalid payload before touching config, the database or web-push", async () => {
    const bad = [
      null,
      {},
      { ...PAYLOAD, title: "" },
      { ...PAYLOAD, route: "https://evil.example/x" },
      { ...PAYLOAD, route: "//evil.example" },
      { ...PAYLOAD, route: "/a\\b" },
      { ...PAYLOAD, type: "Bad Type!" },
      { ...PAYLOAD, notificationId: "not-a-uuid" },
      { ...PAYLOAD, body: "x".repeat(301) },
    ];
    for (const input of bad) expect(await sendPushToUser("u1", input)).toEqual({ status: "invalid_payload" });
    expect(log).toHaveLength(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it.each([
    ["mailto:admin@afit.example", "VAPID_SUBJECT_PLACEHOLDER"],
    ["not-a-contact", "VAPID_SUBJECT_INVALID_FORMAT"],
    ["", "VAPID_SUBJECT_MISSING"],
  ])("refuses to send with VAPID_SUBJECT %j (%s)", async (subject, reason) => {
    vi.stubEnv("VAPID_SUBJECT", subject);
    expect(await sendPushToUser("u1", PAYLOAD)).toEqual({ status: "vapid_not_configured", reason });
    expect(log).toHaveLength(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("refuses when a VAPID key is missing", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    expect(await sendPushToUser("u1", PAYLOAD)).toEqual({ status: "vapid_not_configured", reason: "VAPID_PRIVATE_KEY_MISSING" });
  });

  it("returns no_subscriptions and sends nothing, writing no history", async () => {
    setScript({ push_subscriptions: [{ data: [], error: null }] });

    expect(await sendPushToUser("u1", PAYLOAD, { dedupeKey: "k" })).toEqual({ status: "no_subscriptions" });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(log.some((c) => c.table === "notifications")).toBe(false);
  });

  it("only reads the target user's own non-revoked subscriptions", async () => {
    setScript({ push_subscriptions: [{ data: [], error: null }] });
    await sendPushToUser("target-user", PAYLOAD);

    const filters = log.filter((c) => c.table === "push_subscriptions");
    expect(filters.find((c) => c.method === "eq")?.args).toEqual(["user_id", "target-user"]);
    expect(filters.find((c) => c.method === "is")?.args).toEqual(["revoked_at", null]);
  });
});

describe("sendPushToUser -- delivery", () => {
  it("sends to every active device, updates last_success_at, and marks history sent (never delivered)", async () => {
    setScript({
      push_subscriptions: [{ data: SUBS, error: null }, { error: null }, { error: null }],
      notifications: [{ data: { id: NOTIF_ID }, error: null }, { error: null }],
    });

    const result = await sendPushToUser("u1", PAYLOAD, { dedupeKey: "test:1" });

    expect(result).toMatchObject({ status: "sent", notificationId: NOTIF_ID, sent: 2, expired: 0, failed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(2);

    // Body is the minimal payload plus the history id -- nothing else.
    const [, body, options] = sendNotification.mock.calls[0];
    expect(JSON.parse(body as string)).toEqual({ ...PAYLOAD, notificationId: NOTIF_ID });
    expect(options.vapidDetails).toMatchObject({ subject: "mailto:ops@afitbuilders.in" });
    expect(options.TTL).toBe(3600);

    expect(updates("push_subscriptions").every((u) => typeof u.last_success_at === "string")).toBe(true);

    const historyUpdate = updates("notifications")[0];
    expect(typeof historyUpdate.sent_at).toBe("string");
    expect(historyUpdate).not.toHaveProperty("delivered_at");
    expect(JSON.stringify(log)).not.toContain("delivered_at");
  });

  it("creates the history row from the validated payload with the dedupe key", async () => {
    setScript({
      push_subscriptions: [{ data: [SUBS[0]], error: null }, { error: null }],
      notifications: [{ data: { id: NOTIF_ID }, error: null }, { error: null }],
    });
    await sendPushToUser("u1", PAYLOAD, { dedupeKey: "test:abc", entityType: "lead", entityId: NOTIF_ID });

    const insert = log.find((c) => c.table === "notifications" && c.method === "insert")!.args[0];
    expect(insert).toMatchObject({
      user_id: "u1",
      type: "test",
      title: "Hello",
      body: "World",
      route: "/notifications",
      dedupe_key: "test:abc",
      entity_type: "lead",
    });
    expect(insert).not.toHaveProperty("delivered_at");
    expect(insert).not.toHaveProperty("sent_at");
  });

  it("one device failing does not stop the other; the failure is transient so the subscription is kept", async () => {
    sendNotification.mockResolvedValueOnce({ statusCode: 201 }).mockRejectedValueOnce({ statusCode: 503, body: "secret-body" });
    setScript({
      push_subscriptions: [{ data: SUBS, error: null }, { error: null }],
      notifications: [{ data: { id: NOTIF_ID }, error: null }, { error: null }],
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendPushToUser("u1", PAYLOAD, { dedupeKey: "k" });

    expect(result).toMatchObject({ status: "partial", sent: 1, failed: 1, expired: 0 });
    expect(updates("push_subscriptions")).toHaveLength(1); // only the success touched a row
    expect(updates("push_subscriptions")[0]).toHaveProperty("last_success_at");
    expect(updates("push_subscriptions").some((u) => "revoked_at" in u)).toBe(false);
    // History still marked sent because one device accepted it.
    expect(updates("notifications")[0]).toHaveProperty("sent_at");
    // Logs carry status + subscription id only.
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("status=503");
    expect(logged).not.toContain("secret-body");
    expect(logged).not.toContain("push.example.net");
    errorSpy.mockRestore();
  });

  it.each([404, 410])("revokes a subscription that the push service reports gone (%i) and does not retry it", async (code) => {
    sendNotification.mockRejectedValueOnce({ statusCode: code });
    setScript({
      push_subscriptions: [{ data: [SUBS[0]], error: null }, { error: null }],
      notifications: [{ data: { id: NOTIF_ID }, error: null }],
    });

    const result = await sendPushToUser("u1", PAYLOAD, { dedupeKey: "k" });

    expect(result).toMatchObject({ status: "failed", sent: 0, expired: 1, failed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(updates("push_subscriptions")[0]).toHaveProperty("revoked_at");
    // Nothing was delivered, so history must not claim it was sent.
    expect(updates("notifications")).toHaveLength(0);
  });

  it("a transient failure on the only device keeps the subscription and reports failure", async () => {
    sendNotification.mockRejectedValueOnce(new Error("ECONNRESET"));
    setScript({ push_subscriptions: [{ data: [SUBS[0]], error: null }] });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendPushToUser("u1", PAYLOAD);

    expect(result).toMatchObject({ status: "failed", sent: 0, failed: 1, expired: 0 });
    expect(updates("push_subscriptions")).toHaveLength(0);
    errorSpy.mockRestore();
  });

  it("dedupe: a notification already sent is not pushed again", async () => {
    setScript({
      push_subscriptions: [{ data: SUBS, error: null }],
      notifications: [
        { data: null, error: { code: "23505" } },
        { data: { id: NOTIF_ID, sent_at: "2026-09-20T10:00:00Z" }, error: null },
      ],
    });

    expect(await sendPushToUser("u1", PAYLOAD, { dedupeKey: "same" })).toEqual({ status: "duplicate", notificationId: NOTIF_ID });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("dedupe: an existing history row that was never sent is reused and sent", async () => {
    setScript({
      push_subscriptions: [{ data: [SUBS[0]], error: null }, { error: null }],
      notifications: [
        { data: null, error: { code: "23505" } },
        { data: { id: NOTIF_ID, sent_at: null }, error: null },
        { error: null },
      ],
    });

    const result = await sendPushToUser("u1", PAYLOAD, { dedupeKey: "retry" });

    expect(result).toMatchObject({ status: "sent", notificationId: NOTIF_ID });
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("never leaks endpoints, keys or the private key in its result", async () => {
    setScript({ push_subscriptions: [{ data: SUBS, error: null }, { error: null }, { error: null }] });

    const result = JSON.stringify(await sendPushToUser("u1", PAYLOAD));

    for (const secret of ["push.example.net", '"k1"', '"a1"', PRIVATE_KEY]) expect(result).not.toContain(secret);
  });
});
