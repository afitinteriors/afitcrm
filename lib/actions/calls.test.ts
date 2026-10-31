import { describe, it, expect, vi, beforeEach } from "vitest";

// Same sequential-script Supabase stand-in push.test.ts already established
// for this project: each `.from()` call consumes the next scripted result in
// order, and every method call on a builder is recorded so a test can assert
// exactly what was read/written, not just that a call happened. Both
// chainable methods (select/eq/is/insert/update) and the two terminal
// methods this file's queries actually use (maybeSingle/single) are
// supported; a chain with neither terminal call is itself awaited directly
// (follow_ups update/insert in calls.ts never call select()/single()).
type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

function makeBuilder(result: QueryResult) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = { calls };
  for (const method of ["select", "eq", "is", "insert", "update"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(() => {
    calls.push(["maybeSingle", []]);
    return Promise.resolve(result);
  });
  builder.single = vi.fn(() => {
    calls.push(["single", []]);
    return Promise.resolve(result);
  });
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder as Record<string, unknown> & { calls: Array<[string, unknown[]]> };
}

function createFake(script: QueryResult[]) {
  const builders: ReturnType<typeof makeBuilder>[] = [];
  const fromTables: string[] = [];
  const from = vi.fn((table: string) => {
    fromTables.push(table);
    const b = makeBuilder(script[builders.length] ?? { data: null, error: null });
    builders.push(b);
    return b;
  });
  return { client: { from }, builders, from, fromTables };
}

function callsOf(b: ReturnType<typeof makeBuilder>, method: string) {
  return b.calls.filter(([m]) => m === method).map(([, args]) => args);
}

let client: ReturnType<typeof createFake>;
vi.mock("@/lib/supabase/server", () => ({ createClient: () => client.client }));

const getCurrentProfileMock = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentProfile: () => getCurrentProfileMock() }));

const recordAuditEvent = vi.fn<(input: Record<string, unknown>) => Promise<void>>();
vi.mock("@/lib/audit", () => ({ recordAuditEvent: (input: Record<string, unknown>) => recordAuditEvent(input) }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sendMissedCallTemplateMock = vi.fn<(...args: unknown[]) => Promise<{ status: string; reason?: string }>>();
vi.mock("@/lib/whatsapp/missed-call-template", () => ({
  needsMissedCallTemplate: (outcome: string) => outcome === "no_answer" || outcome === "busy",
  sendMissedCallTemplate: (...args: unknown[]) => sendMissedCallTemplateMock(...args),
}));

import { getMyPendingCall, startCall, resolveCallOutcome } from "./calls";

const ADMIN = { id: "admin-1", role: "admin" as const };
const STAFF = { id: "staff-1", role: "staff" as const };
const LEAD = "lead-1";
const CALL_LOG = "call-1";

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentProfileMock.mockResolvedValue(STAFF);
  client = createFake([]);
  sendMissedCallTemplateMock.mockResolvedValue({ status: "sent" });
});

describe("getMyPendingCall", () => {
  it("returns null for an unauthenticated caller and touches nothing", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    expect(await getMyPendingCall()).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns null when the caller has no pending call", async () => {
    client = createFake([{ data: null, error: null }]);
    expect(await getMyPendingCall()).toBeNull();
  });

  it("maps a pending row (embedded lead as an object) to PendingCall, including whether the lead is already Lost", async () => {
    client = createFake([
      {
        data: {
          id: CALL_LOG,
          lead_id: LEAD,
          started_at: "2026-10-29T10:00:00.000Z",
          leads: { customer_name: "Asha", phone: "+919846321048", status: "qualified" },
        },
        error: null,
      },
    ]);
    expect(await getMyPendingCall()).toEqual({
      id: CALL_LOG,
      leadId: LEAD,
      customerName: "Asha",
      phone: "+919846321048",
      startedAt: "2026-10-29T10:00:00.000Z",
      leadAlreadyLost: false,
    });
  });

  it("surfaces leadAlreadyLost: true when the reopened pending call's lead is already Lost -- so R-CALL-001's reopened popup (on reload/refocus) waives the date requirement exactly like a freshly-opened one would", async () => {
    client = createFake([
      {
        data: {
          id: CALL_LOG,
          lead_id: LEAD,
          started_at: "2026-10-29T10:00:00.000Z",
          leads: { customer_name: "Asha", phone: "+919846321048", status: "lost" },
        },
        error: null,
      },
    ]);
    expect(await getMyPendingCall()).toMatchObject({ leadAlreadyLost: true });
  });

  it("also accepts the embedded lead as an array (PostgREST's other embed shape) and returns null if it's empty", async () => {
    client = createFake([
      { data: { id: CALL_LOG, lead_id: LEAD, started_at: "t", leads: [{ customer_name: "Asha", phone: "+91..." }] }, error: null },
    ]);
    expect(await getMyPendingCall()).toMatchObject({ customerName: "Asha" });

    client = createFake([{ data: { id: CALL_LOG, lead_id: LEAD, started_at: "t", leads: [] }, error: null }]);
    expect(await getMyPendingCall()).toBeNull();
  });
});

describe("startCall", () => {
  it("rejects a missing leadId before touching the database", async () => {
    expect(await startCall("")).toEqual({ error: "Missing lead." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    expect(await startCall(LEAD)).toEqual({ error: "Not signed in." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("inserts a new pending call log on success", async () => {
    client = createFake([{ data: { id: CALL_LOG, lead_id: LEAD }, error: null }]);
    expect(await startCall(LEAD)).toEqual({ ok: true, callLogId: CALL_LOG, leadId: LEAD });

    const [inserted] = callsOf(client.builders[0], "insert")[0] as [Record<string, unknown>];
    // caller_id always comes from the session profile, never a parameter --
    // there is no way to pass a different caller_id into startCall at all.
    expect(inserted).toEqual({ lead_id: LEAD, caller_id: STAFF.id });
  });

  it("is idempotent for a double-press on the SAME lead: a unique_violation (23505) resolves to the existing pending row", async () => {
    client = createFake([
      { data: null, error: { code: "23505" } },
      { data: { id: CALL_LOG, lead_id: LEAD }, error: null },
    ]);
    expect(await startCall(LEAD)).toEqual({ ok: true, callLogId: CALL_LOG, leadId: LEAD });
  });

  it("reports a friendly error when the caller's pending call is for a DIFFERENT lead", async () => {
    client = createFake([
      { data: null, error: { code: "23505" } },
      { data: { id: CALL_LOG, lead_id: "some-other-lead" }, error: null },
    ]);
    expect(await startCall(LEAD)).toEqual({ error: "Finish logging your previous call before starting another." });
  });

  it("fails closed when the insert fails for a reason other than the pending-call conflict (e.g. RLS denies an unowned lead)", async () => {
    client = createFake([{ data: null, error: { code: "42501", message: "permission denied" } }]);
    expect(await startCall(LEAD)).toEqual({ error: "Could not start the call log. You may not have access to this lead." });
  });
});

describe("resolveCallOutcome", () => {
  function pendingCallResult(leadStatus: string) {
    return { data: { id: CALL_LOG, lead_id: LEAD, leads: { status: leadStatus } }, error: null };
  }

  it("rejects a missing callLogId before touching the database", async () => {
    expect(await resolveCallOutcome("", "answered", "", "2026-11-01")).toEqual({ error: "Missing call." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects an outcome outside the fixed set", async () => {
    expect(await resolveCallOutcome(CALL_LOG, "ghosted", "", "2026-11-01")).toEqual({ error: "Pick a call outcome." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    expect(await resolveCallOutcome(CALL_LOG, "answered", "", "2026-11-01")).toEqual({ error: "Not signed in." });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("fails closed when the call_logs row isn't found (not the caller's, already resolved, or doesn't exist) -- never a generic 500", async () => {
    client = createFake([{ data: null, error: null }]);
    expect(await resolveCallOutcome(CALL_LOG, "answered", "", "2026-11-01")).toEqual({
      error: "Could not log this call outcome. You may not have access to it.",
    });
    // The lookup is scoped to the SESSION caller's own id, matching the RLS
    // policy it mirrors -- it's not just filtering by callLogId.
    const idEq = callsOf(client.builders[0], "eq").map((a) => a[0]);
    expect(idEq).toContain("caller_id");
  });

  it("R-CALL-002: requires a valid date for a normal outcome on an open lead", async () => {
    client = createFake([pendingCallResult("new")]);
    expect(await resolveCallOutcome(CALL_LOG, "answered", "", "")).toEqual({ error: "Pick a valid next follow-up date." });
    expect(client.builders).toHaveLength(1); // never reached the update -- validated before writing anything

    client = createFake([pendingCallResult("new")]);
    expect(await resolveCallOutcome(CALL_LOG, "answered", "", "not-a-date")).toEqual({ error: "Pick a valid next follow-up date." });
  });

  it("R-CALL-002: wrong_number is exempt from the date requirement", async () => {
    client = createFake([
      pendingCallResult("new"),
      { data: { id: CALL_LOG, lead_id: LEAD }, error: null },
      { error: null }, // follow_ups.update (complete any pending "call" follow-up)
    ]);
    const result = await resolveCallOutcome(CALL_LOG, "wrong_number", "", "");
    expect(result).toEqual({ ok: true });
    // No follow_ups.insert call -- wrong_number with no date creates nothing.
    expect(client.fromTables.filter((t) => t === "follow_ups")).toHaveLength(1);
  });

  it("R-CALL-002: a lead already at Lost is ALSO exempt from the date requirement, for ANY outcome (not just wrong_number)", async () => {
    client = createFake([
      pendingCallResult("lost"),
      { data: { id: CALL_LOG, lead_id: LEAD }, error: null },
      { error: null },
    ]);
    const result = await resolveCallOutcome(CALL_LOG, "answered", "No longer interested, already lost", "");
    expect(result).toEqual({ ok: true });
  });

  it("the Lost exemption is read from the DATABASE row, not from any client-supplied value -- there is no leadStatus parameter to spoof", async () => {
    // resolveCallOutcome's public signature only takes callLogId/outcome/
    // notes/nextFollowUpDate -- a caller cannot pass a lead status at all,
    // so the only way to reach the exemption is for the lead this call_log
    // row is actually attached to (resolved server-side) to really be Lost.
    expect(resolveCallOutcome.length).toBe(4);
  });

  it("still requires a date for a Won (or any other open-stage) lead even when the embedded lead comes back as an array", async () => {
    client = createFake([{ data: { id: CALL_LOG, lead_id: LEAD, leads: [{ status: "quotation" }] }, error: null }]);
    expect(await resolveCallOutcome(CALL_LOG, "answered", "", "")).toEqual({ error: "Pick a valid next follow-up date." });
  });

  it("on success: writes outcome/notes/date, completes prior pending call follow-ups, creates the new one, and audits -- never logs the message body/notes content beyond what's passed", async () => {
    client = createFake([
      pendingCallResult("qualified"),
      { data: { id: CALL_LOG, lead_id: LEAD }, error: null },
      { error: null }, // follow_ups.update
      { error: null }, // follow_ups.insert
    ]);

    const result = await resolveCallOutcome(CALL_LOG, "answered", "Will call back tomorrow", "2026-11-05");
    expect(result).toEqual({ ok: true });

    const [updatePayload] = callsOf(client.builders[1], "update")[0] as [Record<string, unknown>];
    expect(updatePayload).toMatchObject({ outcome: "answered", notes: "Will call back tomorrow", next_follow_up_date: "2026-11-05" });

    const followUpUpdateCalls = callsOf(client.builders[2], "update")[0] as [Record<string, unknown>];
    expect(followUpUpdateCalls[0]).toMatchObject({ status: "completed" });
    const followUpEqCalls = callsOf(client.builders[2], "eq");
    expect(followUpEqCalls).toEqual(expect.arrayContaining([["lead_id", LEAD], ["type", "call"], ["status", "pending"]]));

    const [inserted] = callsOf(client.builders[3], "insert")[0] as [Record<string, unknown>];
    expect(inserted).toMatchObject({ lead_id: LEAD, type: "call", due_date: "2026-11-05", assigned_to_id: STAFF.id });

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: STAFF.id,
        action: "call_logged",
        targetType: "lead",
        targetId: LEAD,
        metadata: { outcome: "answered", call_log_id: CALL_LOG },
      }),
    );
    // Audit metadata must never carry the call notes (AGENTS.md: never log message/note contents).
    expect(JSON.stringify((recordAuditEvent.mock.calls[0]?.[0] as { metadata: unknown })?.metadata)).not.toContain("tomorrow");
  });

  it("fails closed when the resolving UPDATE itself matches no row (e.g. a concurrent resolve on the same call already completed it)", async () => {
    client = createFake([pendingCallResult("new"), { data: null, error: null }]);
    expect(await resolveCallOutcome(CALL_LOG, "answered", "", "2026-11-05")).toEqual({
      error: "Could not log this call outcome. You may not have access to it.",
    });
    // Never reached the follow_ups writes once the update itself failed.
    expect(client.builders).toHaveLength(2);
  });

  it("admin and staff callers are treated identically -- the exemption and validation rules are role-independent", async () => {
    getCurrentProfileMock.mockResolvedValue(ADMIN);
    client = createFake([pendingCallResult("lost"), { data: { id: CALL_LOG, lead_id: LEAD }, error: null }, { error: null }]);
    expect(await resolveCallOutcome(CALL_LOG, "busy", "", "")).toEqual({ ok: true });
  });

  describe("R-FUP-002: missed-call template trigger", () => {
    function resolveSuccess(outcome: string, date = "2026-11-05") {
      client = createFake([
        pendingCallResult("qualified"),
        { data: { id: CALL_LOG, lead_id: LEAD }, error: null },
        { error: null }, // follow_ups.update
        { error: null }, // follow_ups.insert
      ]);
      return resolveCallOutcome(CALL_LOG, outcome, "", date);
    }

    it("no_answer triggers the missed-call template, for this lead", async () => {
      expect(await resolveSuccess("no_answer")).toEqual({ ok: true });
      expect(sendMissedCallTemplateMock).toHaveBeenCalledTimes(1);
      expect(sendMissedCallTemplateMock).toHaveBeenCalledWith(expect.anything(), LEAD);
    });

    it("busy also triggers it", async () => {
      expect(await resolveSuccess("busy")).toEqual({ ok: true });
      expect(sendMissedCallTemplateMock).toHaveBeenCalledTimes(1);
    });

    it("answered, wrong_number, and not_interested do NOT trigger it", async () => {
      await resolveSuccess("answered");
      expect(sendMissedCallTemplateMock).not.toHaveBeenCalled();

      client = createFake([pendingCallResult("lost"), { data: { id: CALL_LOG, lead_id: LEAD }, error: null }, { error: null }]);
      await resolveCallOutcome(CALL_LOG, "wrong_number", "", "");
      expect(sendMissedCallTemplateMock).not.toHaveBeenCalled();

      client = createFake([pendingCallResult("qualified"), { data: { id: CALL_LOG, lead_id: LEAD }, error: null }, { error: null }, { error: null }]);
      await resolveCallOutcome(CALL_LOG, "not_interested", "", "2026-11-05");
      expect(sendMissedCallTemplateMock).not.toHaveBeenCalled();
    });

    it("a send failure never fails the call-logging action itself -- the outcome is already durably recorded", async () => {
      sendMissedCallTemplateMock.mockResolvedValue({ status: "failed", reason: "WhatsApp did not accept this template message" });
      expect(await resolveSuccess("no_answer")).toEqual({ ok: true });
    });

    it("sendMissedCallTemplate throwing unexpectedly also never fails the call-logging action", async () => {
      sendMissedCallTemplateMock.mockRejectedValue(new Error("network blip"));
      expect(await resolveSuccess("no_answer")).toEqual({ ok: true });
    });
  });
});
