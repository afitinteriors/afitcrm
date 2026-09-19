import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

// Same minimal chainable/thenable query-builder stand-in used across this
// project's other Supabase-backed tests (lib/whatsapp/ingest.test.ts,
// lib/automations/crm-actions.test.ts) -- extended with .neq(), which
// updateLead's duplicate check uses to exclude the lead being edited.
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.neq = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.limit = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function createFakeSupabase(script: Record<string, QueryResult[]>) {
  const counters: Record<string, number> = {};
  const from = vi.fn((table: string) => {
    const idx = counters[table] ?? 0;
    counters[table] = idx + 1;
    const queue = script[table] ?? [];
    return makeBuilder(queue[idx] ?? { data: null, error: null });
  });
  return { stub: { from } as unknown as SupabaseClient<Database>, from };
}

// createClient() is called fresh inside each action -- this module-level
// slot is what the mock below hands back, set per-test before invoking the
// action under test.
let fakeSupabase: SupabaseClient<Database>;
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => fakeSupabase,
}));

const getCurrentProfileMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: () => getCurrentProfileMock(),
}));

const recordAuditEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEventMock(...args),
}));

// Real redirect() throws (NEXT_REDIRECT) to signal Next.js -- mocked as a
// plain no-op so a successful action run completes normally and can be
// asserted on directly, matching how this project's other action tests
// (none existed before this file) would need to handle it.
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createLead, updateLead, setLeadStatus, markLeadWon, markLeadLost } from "./leads";

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ADMIN_PROFILE = { id: "admin-1", role: "admin" as const };
const STAFF_PROFILE = { id: "staff-1", role: "staff" as const };

describe("createLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
  });

  it("canonicalizes a bare Indian number to E.164 before storing and creates the lead", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // duplicate check (canonical form): no match
        { data: [], error: null }, // duplicate check (raw fallback, differs from canonical): no match
        { data: { id: "lead-new" }, error: null }, // insert
      ],
    });
    fakeSupabase = stub;

    // A successful action ends by calling redirect(), which throws in real
    // Next.js -- the mock below is a plain no-op, so the function simply
    // falls through afterward rather than returning ActionState's usual
    // { error } shape. The redirect call itself is what proves success.
    await createLead(null, formDataWith({ phone: "9876543210", customer_name: "Test" }));

    const insertBuilder = from.mock.results[2].value as { insert: ReturnType<typeof vi.fn> };
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ phone: "+919876543210" }));
    expect(redirectMock).toHaveBeenCalledWith("/leads/lead-new");
  });

  it("rejects an unparseable phone number without touching the database at all", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await createLead(null, formDataWith({ phone: "not-a-phone-number" }));

    expect(result).toEqual({ error: expect.stringContaining("valid phone number") });
    expect(from).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects creation when a lead with the same canonical phone already exists -- no insert attempted", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: [{ id: "lead-existing" }], error: null }], // duplicate check: match found
    });
    fakeSupabase = stub;

    const result = await createLead(null, formDataWith({ phone: "+91 98765 43210" }));

    expect(result).toEqual({ error: "A lead with this phone number already exists." });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("catches a duplicate stored under the pre-canonicalization raw format (legacy fallback)", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // canonical-form check: no match
        { data: [{ id: "lead-legacy" }], error: null }, // raw-form fallback check: match found
      ],
    });
    fakeSupabase = stub;

    // Raw WABIS-shaped value (no +), differs from its canonical form.
    const result = await createLead(null, formDataWith({ phone: "919876543210" }));

    expect(result).toEqual({ error: "A lead with this phone number already exists." });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(2);
  });

  it("preserves an international number's real country code", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null },
        { data: [], error: null }, // raw fallback (formatting differs from canonical)
        { data: { id: "lead-us" }, error: null },
      ],
    });
    fakeSupabase = stub;

    await createLead(null, formDataWith({ phone: "+1 415 555 2671" }));

    const insertBuilder = from.mock.results[2].value as { insert: ReturnType<typeof vi.fn> };
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ phone: "+14155552671" }));
  });
});

describe("updateLead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
  });

  it("canonicalizes the phone number before storing it on update", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // duplicate check (canonical form): no other lead has it
        { data: [], error: null }, // duplicate check (raw fallback, differs from canonical): no match
        { error: null }, // update
      ],
    });
    fakeSupabase = stub;

    await updateLead(
      null,
      formDataWith({ lead_id: "lead-1", phone: "91-98765-43210", customer_name: "Test" })
    );

    const updateBuilder = from.mock.results[2].value as { update: ReturnType<typeof vi.fn> };
    expect(updateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ phone: "+919876543210" }));
    expect(redirectMock).toHaveBeenCalledWith("/leads/lead-1");
  });

  it("excludes the lead being edited from its own duplicate check -- resubmitting the same number (reformatted) succeeds", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // duplicate check (canonical form) excludes lead-1 itself: no OTHER match
        { data: [], error: null }, // duplicate check (raw fallback) excludes lead-1 itself: no OTHER match
        { error: null }, // update
      ],
    });
    fakeSupabase = stub;

    await updateLead(
      null,
      formDataWith({ lead_id: "lead-1", phone: "+91 98765 43210" }) // same number, different formatting
    );

    const duplicateCheckBuilder = from.mock.results[0].value as { neq: ReturnType<typeof vi.fn> };
    expect(duplicateCheckBuilder.neq).toHaveBeenCalledWith("id", "lead-1");
    expect(redirectMock).toHaveBeenCalledWith("/leads/lead-1");
  });

  it("rejects the update when a DIFFERENT lead already uses this phone number", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: [{ id: "lead-other" }], error: null }], // another lead has this phone
    });
    fakeSupabase = stub;

    const result = await updateLead(null, formDataWith({ lead_id: "lead-1", phone: "9876543210" }));

    expect(result).toEqual({ error: "Another lead already uses this phone number." });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects an unparseable phone number on update without touching the database", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await updateLead(null, formDataWith({ lead_id: "lead-1", phone: "garbage" }));

    expect(result).toEqual({ error: expect.stringContaining("valid phone number") });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("setLeadStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
  });

  // Won/Lost stage-direction guard: setLeadStatus() must read the lead's
  // CURRENT status and refuse to move it anywhere once that current status
  // is "won" or "lost" -- both are terminal through this generic setter.
  // See the investigation of lead 88b62dab-fe58-4ad4-90ad-9fcd00edadc5,
  // which reached status=quotation with a stale Won-only job_value by going
  // won -> quotation through this exact path before the guard existed.

  it("allows quotation -> negotiation (admin)", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: { status: "quotation" }, error: null }, // current-status read
        { error: null }, // update
      ],
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "negotiation");

    expect(result).toBeNull();
    const updateBuilder = from.mock.results[1].value as { update: ReturnType<typeof vi.fn> };
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: "negotiation", lost_reason: null });
  });

  it("allows qualified -> site_visit (admin)", async () => {
    const { stub } = createFakeSupabase({
      leads: [
        { data: { status: "qualified" }, error: null },
        { error: null },
      ],
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "site_visit");

    expect(result).toBeNull();
  });

  it("allows site_visit -> quotation (admin)", async () => {
    const { stub } = createFakeSupabase({
      leads: [
        { data: { status: "site_visit" }, error: null },
        { error: null },
      ],
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "quotation");

    expect(result).toBeNull();
  });

  it("rejects won -> quotation and never issues an update", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { status: "won" }, error: null }], // current-status read only
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "quotation");

    expect(result).toEqual({ error: expect.stringContaining("closed (Won/Lost)") });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });

  it("rejects won -> negotiation and never issues an update", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { status: "won" }, error: null }],
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "negotiation");

    expect(result).toEqual({ error: expect.stringContaining("closed (Won/Lost)") });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });

  it("rejects lost -> quotation and never issues an update", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { status: "lost" }, error: null }],
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "quotation");

    expect(result).toEqual({ error: expect.stringContaining("closed (Won/Lost)") });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });

  it("rejects lost -> new and never issues an update", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { status: "lost" }, error: null }],
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "new");

    expect(result).toEqual({ error: expect.stringContaining("closed (Won/Lost)") });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });

  it("still rejects a direct target of won, before touching the database", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "won");

    expect(result).toEqual({ error: "Use Mark as Won or Mark as Lost to set this status." });
    expect(from).not.toHaveBeenCalled();
  });

  it("still rejects a direct target of lost, before touching the database", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "lost");

    expect(result).toEqual({ error: "Use Mark as Won or Mark as Lost to set this status." });
    expect(from).not.toHaveBeenCalled();
  });

  it("preserves existing authorization: staff cannot change a lead not assigned to them", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { assigned_to_id: "someone-else" }, error: null }], // checkLeadAccess
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "negotiation");

    expect(result).toEqual({ error: "You do not have access to this lead." });
    // Only the access check ran -- the guard's current-status read and the
    // update itself must never be reached for an unauthorized caller.
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });

  it("preserves existing authorization: staff CAN change a lead assigned to them", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: { assigned_to_id: "staff-1" }, error: null }, // checkLeadAccess
        { data: { status: "qualified" }, error: null }, // current-status read
        { error: null }, // update
      ],
    });
    fakeSupabase = stub;

    const result = await setLeadStatus("lead-1", "site_visit");

    expect(result).toBeNull();
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(3);
  });
});

describe("markLeadWon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
  });

  // Data-integrity guard: a lead must not become Won without a real
  // job_value -- previously job_value was accepted as fully optional here
  // (unlike markLeadLost's lost_reason, which was always required), letting
  // Won leads silently carry a null job_value and understate every report
  // that sums/averages job_value for won leads (Dashboard Revenue,
  // Reports' Won/Lost and Sales Performance sections).

  it("rejects marking Won with no job_value at all -- no database access whatsoever", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await markLeadWon(null, formDataWith({ lead_id: "lead-1" }));

    expect(result).toEqual({ error: "A valid job value is required to mark a lead as Won." });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["empty string", ""],
    ["non-numeric", "not-a-number"],
    ["zero", "0"],
    ["negative", "-500"],
  ])("rejects marking Won with an invalid job_value (%s) -- no database access whatsoever", async (_label, value) => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await markLeadWon(null, formDataWith({ lead_id: "lead-1", job_value: value }));

    expect(result).toEqual({ error: "A valid job value is required to mark a lead as Won." });
    expect(from).not.toHaveBeenCalled();
  });

  it("succeeds with a valid positive job_value, sets status won and clears lost_reason", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ error: null }], // update
    });
    fakeSupabase = stub;

    const result = await markLeadWon(null, formDataWith({ lead_id: "lead-1", job_value: "50000" }));

    expect(result).toBeNull();
    const updateBuilder = from.mock.results[0].value as { update: ReturnType<typeof vi.fn> };
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: "won", job_value: 50000, lost_reason: null });
  });

  it("preserves existing authorization: staff cannot mark Won a lead not assigned to them, even with a valid job_value", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { assigned_to_id: "someone-else" }, error: null }], // checkLeadAccess
    });
    fakeSupabase = stub;

    const result = await markLeadWon(null, formDataWith({ lead_id: "lead-1", job_value: "50000" }));

    expect(result).toEqual({ error: "You do not have access to this lead." });
    // The job_value guard runs first and passes; only the access check
    // should have touched the database after that.
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });

  it("preserves existing authorization: staff CAN mark Won a lead assigned to them", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: { assigned_to_id: "staff-1" }, error: null }, // checkLeadAccess
        { error: null }, // update
      ],
    });
    fakeSupabase = stub;

    const result = await markLeadWon(null, formDataWith({ lead_id: "lead-1", job_value: "25000" }));

    expect(result).toBeNull();
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(2);
  });
});

describe("markLeadLost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
  });

  // Confirms markLeadLost's pre-existing behavior is unchanged by the
  // markLeadWon fix above -- same validate-before-access-check shape, but
  // its own required field (lost_reason) and success path are untouched.

  it("still rejects marking Lost with no lost_reason -- no database access whatsoever", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await markLeadLost(null, formDataWith({ lead_id: "lead-1" }));

    expect(result).toEqual({ error: "A lost reason is required." });
    expect(from).not.toHaveBeenCalled();
  });

  it("still succeeds with a valid lost_reason, setting status lost", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ error: null }], // update
    });
    fakeSupabase = stub;

    const result = await markLeadLost(
      null,
      formDataWith({ lead_id: "lead-1", lost_reason: "Went with a competitor" })
    );

    expect(result).toBeNull();
    const updateBuilder = from.mock.results[0].value as { update: ReturnType<typeof vi.fn> };
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "lost",
      lost_reason: "Went with a competitor",
    });
  });

  it("preserves existing authorization: staff cannot mark Lost a lead not assigned to them", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { assigned_to_id: "someone-else" }, error: null }], // checkLeadAccess
    });
    fakeSupabase = stub;

    const result = await markLeadLost(null, formDataWith({ lead_id: "lead-1", lost_reason: "Budget" }));

    expect(result).toEqual({ error: "You do not have access to this lead." });
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });
});
