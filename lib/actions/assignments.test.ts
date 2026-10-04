import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  profile: null as { id: string; role: string } | null,
  leadsUpdateResult: { data: [] as { id: string }[], error: null as unknown },
  staffFound: true,
  queriedTables: [] as string[],
}));
const recordAuditEvent = vi.hoisted(() => vi.fn(async () => {}));

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "is", "not", "update", "order"]) c[m] = () => c;
  c.single = async () => result;
  c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
  return c;
}

vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => state.profile }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      state.queriedTables.push(table);
      if (table === "profiles") return chain({ data: state.staffFound ? { id: STAFF } : null });
      return chain(state.leadsUpdateResult);
    },
  }),
}));

import { bulkAssignUnassignedLeads } from "./assignments";
import { MAX_BULK_ASSIGN } from "@/lib/assignment-logic";

const STAFF = "11111111-1111-4111-8111-111111111111";
const L1 = "22222222-2222-4222-8222-222222222222";
const L2 = "33333333-3333-4333-8333-333333333333";

describe("bulkAssignUnassignedLeads", () => {
  beforeEach(() => {
    state.profile = { id: "admin-1", role: "admin" };
    state.leadsUpdateResult = { data: [{ id: L1 }], error: null };
    state.staffFound = true;
    state.queriedTables = [];
    recordAuditEvent.mockClear();
  });

  it("refuses a staff caller and writes nothing", async () => {
    state.profile = { id: "staff-1", role: "staff" };
    const result = await bulkAssignUnassignedLeads([L1], STAFF);
    expect(result).toEqual({ error: "Only an admin can assign leads." });
    expect(state.queriedTables).toEqual([]);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    state.profile = null;
    expect(await bulkAssignUnassignedLeads([L1], STAFF)).toEqual({ error: "Not signed in." });
  });

  it("rejects an empty or oversized selection", async () => {
    expect(await bulkAssignUnassignedLeads([], STAFF)).toEqual({ error: "Select at least one lead." });
    const tooMany = Array.from({ length: MAX_BULK_ASSIGN + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(await bulkAssignUnassignedLeads(tooMany, STAFF)).toEqual({ error: `Select at most ${MAX_BULK_ASSIGN} leads at once.` });
  });

  it("rejects malformed ids before touching the database", async () => {
    expect(await bulkAssignUnassignedLeads(["not-a-uuid"], STAFF)).toEqual({ error: "Invalid lead selection." });
    expect(await bulkAssignUnassignedLeads([L1], "bad")).toEqual({ error: "Select a valid staff member." });
    expect(state.queriedTables).toEqual([]);
  });

  it("refuses a target that is not an active staff profile", async () => {
    state.staffFound = false;
    expect(await bulkAssignUnassignedLeads([L1], STAFF)).toEqual({ error: "Select a valid staff member." });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("assigns only leads that were still unassigned, reports skipped ones, and audits each assignment", async () => {
    state.leadsUpdateResult = { data: [{ id: L1 }], error: null }; // L2 was already assigned elsewhere
    const result = await bulkAssignUnassignedLeads([L1, L2, L1], STAFF);
    expect(result).toEqual({ assigned: 1, skipped: 1 });
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "lead_assigned",
        targetType: "lead",
        targetId: L1,
        metadata: expect.objectContaining({ previous_staff_id: null, new_staff_id: STAFF, bulk: true }),
      }),
    );
  });

  it("returns an error when the database write fails", async () => {
    state.leadsUpdateResult = { data: [], error: { message: "boom" } };
    expect(await bulkAssignUnassignedLeads([L1], STAFF)).toEqual({ error: "Could not assign the selected leads." });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
