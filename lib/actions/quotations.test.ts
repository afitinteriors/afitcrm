import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

// Same minimal chainable/thenable query-builder stand-in used across this
// project's other Supabase-backed action tests (lib/actions/leads.test.ts
// etc.), per-table, sequentially consumed.
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { saveQuotationDraft, sendQuotation } from "./quotations";

const ADMIN_PROFILE = { id: "admin-1", role: "admin" as const };
const STAFF_PROFILE = { id: "staff-1", role: "staff" as const };

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
});

describe("saveQuotationDraft -- R-QUOTE-001 (docs/BLUEPRINT_V1.md Section 8)", () => {
  it("rejects a missing/invalid amount before any database access", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    for (const amount of ["", "not-a-number", "0", "-500"]) {
      expect(await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount }))).toEqual({
        error: "Enter a valid quotation amount.",
      });
    }
    expect(from).not.toHaveBeenCalled();
  });

  it("creates version 1 when no quotation exists yet for this lead", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [{ data: null, error: null }], // no latest -> insert
      leads: [{ error: null }], // quotation_amount sync
    });
    fakeSupabase = stub;

    const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "50000", notes: "First pass" }));

    expect(result).toBeNull();
    // from() order for an ADMIN caller (checkLeadAccess makes no DB call
    // for admin): 0 quotations.select (latest, miss), 1 quotations.insert,
    // 2 leads.update (quotation_amount sync).
    const insertBuilder = from.mock.results[1].value as { insert: ReturnType<typeof vi.fn> };
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ lead_id: "lead-1", version: 1, amount: 50000, notes: "First pass", created_by: "admin-1" }),
    );
    const leadsBuilder = from.mock.results[2].value as { update: ReturnType<typeof vi.fn> };
    expect(leadsBuilder.update).toHaveBeenCalledWith({ quotation_amount: 50000 });
  });

  it("updates the existing DRAFT in place instead of creating a new version", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [{ data: { id: "q-1", version: 1, status: "draft" }, error: null }],
      leads: [{ error: null }],
    });
    fakeSupabase = stub;

    const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "55000" }));

    expect(result).toBeNull();
    // 0 quotations.select (latest, hit), 1 quotations.update (in place).
    const updateBuilder = from.mock.results[1].value as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    expect(updateBuilder.update).toHaveBeenCalledWith({ amount: 55000, notes: null });
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "q-1");
  });

  it("creates version 2 when the latest version is already SENT (locked) -- never edits a sent row", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [{ data: { id: "q-1", version: 1, status: "sent" }, error: null }],
      leads: [{ error: null }],
    });
    fakeSupabase = stub;

    const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "60000" }));

    expect(result).toBeNull();
    const insertBuilder = from.mock.results[1].value as { insert: ReturnType<typeof vi.fn> };
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ version: 2, amount: 60000 }));
  });

  it("syncs leads.quotation_amount to the saved amount for backward compatibility with dashboard/reports/Commercial", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [{ data: null, error: null }],
      leads: [{ error: null }],
    });
    fakeSupabase = stub;

    await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "42000" }));

    const leadsBuilder = from.mock.results[2].value as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    expect(leadsBuilder.update).toHaveBeenCalledWith({ quotation_amount: 42000 });
    expect(leadsBuilder.eq).toHaveBeenCalledWith("id", "lead-1");
  });

  it("preserves existing authorization: staff cannot save a quotation for a lead not assigned to them", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { assigned_to_id: "someone-else" }, error: null }], // checkLeadAccess
    });
    fakeSupabase = stub;

    const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "50000" }));

    expect(result).toEqual({ error: "You do not have access to this lead." });
    expect(from.mock.calls.filter(([table]) => table === "quotations")).toHaveLength(0);
  });
});

describe("sendQuotation -- R-QUOTE-001", () => {
  it("rejects missing ids before any database access", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    expect(await sendQuotation(null, formDataWith({ lead_id: "lead-1" }))).toEqual({ error: "Missing quotation." });
    expect(await sendQuotation(null, formDataWith({ quotation_id: "q-1" }))).toEqual({ error: "Missing quotation." });
    expect(from).not.toHaveBeenCalled();
  });

  it("locks a draft quotation: sets status sent and sent_at", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [{ data: { id: "q-1" }, error: null }],
    });
    fakeSupabase = stub;

    const result = await sendQuotation(null, formDataWith({ quotation_id: "q-1", lead_id: "lead-1" }));

    expect(result).toBeNull();
    const updateBuilder = from.mock.results[0].value as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    const [payload] = updateBuilder.update.mock.calls[0] as [Record<string, unknown>];
    expect(payload.status).toBe("sent");
    expect(typeof payload.sent_at).toBe("string");
    expect(updateBuilder.eq).toHaveBeenCalledWith("status", "draft");
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "q-1");
    expect(updateBuilder.eq).toHaveBeenCalledWith("lead_id", "lead-1");
  });

  it("rejects when the quotation is already sent (or doesn't match) -- the scoped UPDATE matches no row", async () => {
    const { stub } = createFakeSupabase({
      quotations: [{ data: null, error: null }], // .eq("status","draft") matched nothing
    });
    fakeSupabase = stub;

    const result = await sendQuotation(null, formDataWith({ quotation_id: "q-1", lead_id: "lead-1" }));

    expect(result).toEqual({ error: "This quotation could not be sent (it may already be sent)." });
  });

  it("preserves existing authorization: staff cannot send a quotation for a lead not assigned to them", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { assigned_to_id: "someone-else" }, error: null }],
    });
    fakeSupabase = stub;

    const result = await sendQuotation(null, formDataWith({ quotation_id: "q-1", lead_id: "lead-1" }));

    expect(result).toEqual({ error: "You do not have access to this lead." });
    expect(from.mock.calls.filter(([table]) => table === "quotations")).toHaveLength(0);
  });
});
