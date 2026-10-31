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

// R-QUOTE-002's admin-alert step uses the service-role client (a staff
// caller's RLS-scoped session client cannot list other admins' profile
// rows -- profiles_select_self_or_admin). Scripted separately from the
// session client above.
let fakeAdminSupabase: SupabaseClient<Database>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeAdminSupabase,
}));

const sendDedupedAlertMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/rules/alert", () => ({
  sendDedupedAlert: (...args: unknown[]) => sendDedupedAlertMock(...args),
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

import { approveQuotationDiscount, saveQuotationDraft, sendQuotation } from "./quotations";

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
  fakeAdminSupabase = createFakeSupabase({}).stub;
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
      quotations: [
        { data: null, error: null }, // no latest -> insert
        { data: { id: "q-new-1" }, error: null }, // insert result
      ],
      leads: [{ error: null }], // quotation_amount sync
    });
    fakeSupabase = stub;

    const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "50000", notes: "First pass" }));

    expect(result).toBeNull();
    // from() order for an ADMIN caller (checkLeadAccess makes no DB call
    // for admin): 0 quotations.select (latest, miss), 1 quotations.insert,
    // 2 leads.update (quotation_amount sync). Version 1 has nothing to
    // discount against, so no further quotations/admin-alert calls happen.
    const insertBuilder = from.mock.results[1].value as { insert: ReturnType<typeof vi.fn> };
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ lead_id: "lead-1", version: 1, amount: 50000, notes: "First pass", created_by: "admin-1" }),
    );
    const leadsBuilder = from.mock.results[2].value as { update: ReturnType<typeof vi.fn> };
    expect(leadsBuilder.update).toHaveBeenCalledWith({ quotation_amount: 50000 });
    expect(sendDedupedAlertMock).not.toHaveBeenCalled();
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
      quotations: [
        { data: { id: "q-1", version: 1, status: "sent" }, error: null },
        { data: { id: "q-new-2" }, error: null }, // insert result
        { data: { amount: 60000 }, error: null }, // getDiscountPercentForVersion's v1 lookup -- same amount, 0% discount
      ],
      leads: [{ error: null }],
    });
    fakeSupabase = stub;

    const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "60000" }));

    expect(result).toBeNull();
    const insertBuilder = from.mock.results[1].value as { insert: ReturnType<typeof vi.fn> };
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ version: 2, amount: 60000 }));
    expect(sendDedupedAlertMock).not.toHaveBeenCalled(); // 0% discount, nothing to alert
  });

  it("syncs leads.quotation_amount to the saved amount for backward compatibility with dashboard/reports/Commercial", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [
        { data: null, error: null },
        { data: { id: "q-new" }, error: null },
      ],
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

  describe("R-QUOTE-002: discount-approval alert on save", () => {
    it("alerts every active admin when a new version's discount exceeds the limit", async () => {
      const { stub, from } = createFakeSupabase({
        quotations: [
          { data: { id: "q-1", version: 1, status: "sent" }, error: null },
          { data: { id: "q-new-2" }, error: null },
          { data: { amount: 100000 }, error: null }, // v1 amount -> 92000 is an 8% discount
        ],
        leads: [{ error: null }],
      });
      fakeSupabase = stub;
      const { stub: adminStub } = createFakeSupabase({
        leads: [{ data: { customer_name: "Rahul K.", phone: "+919999999999" }, error: null }],
        profiles: [{ data: [{ id: "admin-1" }, { id: "admin-2" }], error: null }],
      });
      fakeAdminSupabase = adminStub;

      const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "92000" }));

      expect(result).toBeNull();
      expect(sendDedupedAlertMock).toHaveBeenCalledTimes(2);
      expect(sendDedupedAlertMock).toHaveBeenCalledWith(
        adminStub,
        expect.objectContaining({
          userId: "admin-1",
          entityId: "lead-1",
          dedupeKey: "quotation-discount:q-new-2",
          type: "quotation.discount_approval",
          route: "/leads/lead-1",
        }),
      );
      expect(sendDedupedAlertMock).toHaveBeenCalledWith(adminStub, expect.objectContaining({ userId: "admin-2" }));
      expect(from.mock.calls.filter(([table]) => table === "quotations")).toHaveLength(3);
    });

    it("does not alert when the new version's discount is within the limit", async () => {
      const { stub } = createFakeSupabase({
        quotations: [
          { data: { id: "q-1", version: 1, status: "sent" }, error: null },
          { data: { id: "q-new-2" }, error: null },
          { data: { amount: 100000 }, error: null }, // 96000 is a 4% discount -- within the 5% default limit
        ],
        leads: [{ error: null }],
      });
      fakeSupabase = stub;

      const result = await saveQuotationDraft(null, formDataWith({ lead_id: "lead-1", amount: "96000" }));

      expect(result).toBeNull();
      expect(sendDedupedAlertMock).not.toHaveBeenCalled();
    });
  });
});

describe("sendQuotation -- R-QUOTE-001 / R-QUOTE-002", () => {
  it("rejects missing ids before any database access", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    expect(await sendQuotation(null, formDataWith({ lead_id: "lead-1" }))).toEqual({ error: "Missing quotation." });
    expect(await sendQuotation(null, formDataWith({ quotation_id: "q-1" }))).toEqual({ error: "Missing quotation." });
    expect(from).not.toHaveBeenCalled();
  });

  it("locks a draft quotation: sets status sent and sent_at (version 1 -- no discount to check)", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [
        { data: { version: 1, amount: 50000, discount_approved_at: null }, error: null }, // discount pre-check
        { data: { id: "q-1" }, error: null }, // the actual lock
      ],
    });
    fakeSupabase = stub;

    const result = await sendQuotation(null, formDataWith({ quotation_id: "q-1", lead_id: "lead-1" }));

    expect(result).toBeNull();
    const updateBuilder = from.mock.results[1].value as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    const [payload] = updateBuilder.update.mock.calls[0] as [Record<string, unknown>];
    expect(payload.status).toBe("sent");
    expect(typeof payload.sent_at).toBe("string");
    expect(updateBuilder.eq).toHaveBeenCalledWith("status", "draft");
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "q-1");
    expect(updateBuilder.eq).toHaveBeenCalledWith("lead_id", "lead-1");
  });

  it("rejects when the quotation is already sent (or doesn't match) -- the scoped UPDATE matches no row", async () => {
    const { stub } = createFakeSupabase({
      quotations: [
        { data: { version: 1, amount: 50000, discount_approved_at: null }, error: null },
        { data: null, error: null }, // .eq("status","draft") matched nothing
      ],
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

  describe("R-QUOTE-002: discount approval gate", () => {
    it("blocks sending when the discount exceeds the limit and isn't approved -- never reaches the lock UPDATE", async () => {
      const { stub, from } = createFakeSupabase({
        quotations: [
          { data: { version: 2, amount: 92000, discount_approved_at: null }, error: null }, // pre-check
          { data: { amount: 100000 }, error: null }, // v1 lookup -> 8% discount
        ],
      });
      fakeSupabase = stub;

      const result = await sendQuotation(null, formDataWith({ quotation_id: "q-2", lead_id: "lead-1" }));

      expect(result).toEqual({
        error: "This quotation is 8% below the original price (limit 5%) and needs admin approval before it can be sent.",
      });
      expect(from.mock.calls.filter(([table]) => table === "quotations")).toHaveLength(2);
    });

    it("allows sending once the discount has been approved, without re-checking the percentage", async () => {
      const { stub, from } = createFakeSupabase({
        quotations: [
          { data: { version: 2, amount: 92000, discount_approved_at: "2026-10-31T10:00:00.000Z" }, error: null },
          { data: { id: "q-2" }, error: null }, // the lock
        ],
      });
      fakeSupabase = stub;

      const result = await sendQuotation(null, formDataWith({ quotation_id: "q-2", lead_id: "lead-1" }));

      expect(result).toBeNull();
      // Only 2 quotations calls: pre-check + lock -- approved rows skip the v1 lookup entirely.
      expect(from.mock.calls.filter(([table]) => table === "quotations")).toHaveLength(2);
    });

    it("allows sending when the discount is within the limit", async () => {
      const { stub } = createFakeSupabase({
        quotations: [
          { data: { version: 2, amount: 96000, discount_approved_at: null }, error: null },
          { data: { amount: 100000 }, error: null }, // 4% discount, within the 5% limit
          { data: { id: "q-2" }, error: null }, // the lock
        ],
      });
      fakeSupabase = stub;

      const result = await sendQuotation(null, formDataWith({ quotation_id: "q-2", lead_id: "lead-1" }));

      expect(result).toBeNull();
    });
  });
});

describe("approveQuotationDiscount -- R-QUOTE-002", () => {
  it("rejects a non-admin caller before any database access", async () => {
    getCurrentProfileMock.mockResolvedValue(STAFF_PROFILE);
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    const result = await approveQuotationDiscount(null, formDataWith({ quotation_id: "q-2", lead_id: "lead-1" }));

    expect(result).toEqual({ error: "Only an admin can approve a discount." });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    expect(await approveQuotationDiscount(null, formDataWith({ quotation_id: "q-2", lead_id: "lead-1" }))).toEqual({
      error: "Not signed in.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects missing ids before any database access", async () => {
    const { stub, from } = createFakeSupabase({});
    fakeSupabase = stub;

    expect(await approveQuotationDiscount(null, formDataWith({ lead_id: "lead-1" }))).toEqual({ error: "Missing quotation." });
    expect(from).not.toHaveBeenCalled();
  });

  it("on success: sets discount_approved_by/at to the approving admin, scoped to this exact row", async () => {
    const { stub, from } = createFakeSupabase({
      quotations: [{ data: { id: "q-2" }, error: null }],
    });
    fakeSupabase = stub;

    const result = await approveQuotationDiscount(null, formDataWith({ quotation_id: "q-2", lead_id: "lead-1" }));

    expect(result).toBeNull();
    const updateBuilder = from.mock.results[0].value as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    const [payload] = updateBuilder.update.mock.calls[0] as [Record<string, unknown>];
    expect(payload.discount_approved_by).toBe("admin-1");
    expect(typeof payload.discount_approved_at).toBe("string");
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "q-2");
    expect(updateBuilder.eq).toHaveBeenCalledWith("lead_id", "lead-1");
  });

  it("fails closed when the quotation doesn't exist / match", async () => {
    const { stub } = createFakeSupabase({
      quotations: [{ data: null, error: null }],
    });
    fakeSupabase = stub;

    const result = await approveQuotationDiscount(null, formDataWith({ quotation_id: "q-2", lead_id: "lead-1" }));

    expect(result).toEqual({ error: "This quotation could not be found." });
  });
});
