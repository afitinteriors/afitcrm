import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnrespondedLeadsMock = vi.fn();
const bucketByOverdueMock = vi.fn();
vi.mock("@/lib/rules/response-timer", () => ({
  findUnrespondedLeads: (...args: unknown[]) => findUnrespondedLeadsMock(...args),
  bucketByOverdue: (...args: unknown[]) => bucketByOverdueMock(...args),
}));

const findStageTrackedLeadsMock = vi.fn();
const bucketStageOverdueMock = vi.fn();
vi.mock("@/lib/rules/stage-timer", () => ({
  findStageTrackedLeads: (...args: unknown[]) => findStageTrackedLeadsMock(...args),
  bucketStageOverdue: (...args: unknown[]) => bucketStageOverdueMock(...args),
}));

import { getAttentionItems } from "./attention";

const NOW = new Date("2026-10-31T10:00:00.000Z");

type LeadFixture = { id: string; location: string | null; service_required: string | null; project_type: string | null; assigned_to_id: string | null };

function makeSupabase(opts: { followUps?: { lead_id: string; assigned_to_id: string | null }[]; leads?: LeadFixture[] }) {
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "follow_ups") {
      return {
        select: () => ({
          eq: () => ({
            lte: () => Promise.resolve({ data: opts.followUps ?? [], error: null }),
          }),
        }),
      };
    }
    if (table === "leads") {
      return {
        select: () => ({
          in: () => Promise.resolve({ data: opts.leads ?? [], error: null }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from } as never;
}

describe("getAttentionItems", () => {
  beforeEach(() => {
    findUnrespondedLeadsMock.mockReset().mockResolvedValue([]);
    bucketByOverdueMock.mockReset().mockReturnValue({ overdueStaff: [], overdueOwner: [] });
    findStageTrackedLeadsMock.mockReset().mockResolvedValue([]);
    bucketStageOverdueMock.mockReset().mockReturnValue({ overdueStaff: [], overdueOwner: [] });
  });

  it("returns an empty list when nothing is overdue", async () => {
    const supabase = makeSupabase({});
    expect(await getAttentionItems(supabase, NOW)).toEqual([]);
  });

  it("builds a privacy-safe item for an unresponded lead -- no phone or name", async () => {
    bucketByOverdueMock.mockReturnValue({ overdueStaff: [{ id: "lead-1", assigned_to_id: "staff-1" }], overdueOwner: [] });
    const supabase = makeSupabase({
      leads: [{ id: "lead-1", location: "Kollam", service_required: "Gypsum plastering", project_type: "Residential", assigned_to_id: "staff-1" }],
    });

    const items = await getAttentionItems(supabase, NOW);

    expect(items).toEqual([
      { reference: "Lead LEAD-1 — Kollam — Gypsum plastering", crmUrl: "/leads/lead-1", reasonKind: "unresponded", assignedToId: "staff-1" },
    ]);
  });

  it("builds a stage_overdue item", async () => {
    bucketStageOverdueMock.mockReturnValue({ overdueStaff: [{ id: "lead-2", assigned_to_id: null }], overdueOwner: [] });
    const supabase = makeSupabase({
      leads: [{ id: "lead-2", location: "Kochi", service_required: null, project_type: "Interior", assigned_to_id: null }],
    });

    const items = await getAttentionItems(supabase, NOW);

    expect(items).toEqual([{ reference: "Lead LEAD-2 — Kochi — Interior", crmUrl: "/leads/lead-2", reasonKind: "stage_overdue", assignedToId: null }]);
  });

  it("builds an overdue_follow_up item from the follow_ups query", async () => {
    const supabase = makeSupabase({
      followUps: [{ lead_id: "lead-3", assigned_to_id: "staff-2" }],
      leads: [{ id: "lead-3", location: "Alappuzha", service_required: "False ceiling", project_type: null, assigned_to_id: "staff-2" }],
    });

    const items = await getAttentionItems(supabase, NOW);

    expect(items).toEqual([
      { reference: "Lead LEAD-3 — Alappuzha — False ceiling", crmUrl: "/leads/lead-3", reasonKind: "overdue_follow_up", assignedToId: "staff-2" },
    ]);
  });

  it("includes one item per reason when the same lead trips multiple rules", async () => {
    bucketByOverdueMock.mockReturnValue({ overdueStaff: [{ id: "lead-4", assigned_to_id: "staff-1" }], overdueOwner: [] });
    const supabase = makeSupabase({
      followUps: [{ lead_id: "lead-4", assigned_to_id: "staff-1" }],
      leads: [{ id: "lead-4", location: "Kollam", service_required: "Gypsum plastering", project_type: null, assigned_to_id: "staff-1" }],
    });

    const items = await getAttentionItems(supabase, NOW);

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.reasonKind).sort()).toEqual(["overdue_follow_up", "unresponded"]);
  });

  it("skips a lead id that no longer resolves to a row instead of guessing", async () => {
    bucketByOverdueMock.mockReturnValue({ overdueStaff: [{ id: "lead-gone", assigned_to_id: "staff-1" }], overdueOwner: [] });
    const supabase = makeSupabase({ leads: [] });

    expect(await getAttentionItems(supabase, NOW)).toEqual([]);
  });
});
