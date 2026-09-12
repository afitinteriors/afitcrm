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

import { createLead, updateLead } from "./leads";

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ADMIN_PROFILE = { id: "admin-1", role: "admin" as const };

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
