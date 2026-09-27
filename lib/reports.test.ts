import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type LeadRow = {
  id: string;
  status: string;
  job_value: number | null;
  quotation_amount: number | null;
  assigned_to_id: string | null;
  qualification_score: number | null;
  service_required: string | null;
  lost_reason: string | null;
  source: string | null;
  created_at: string;
};
type FollowUpRow = {
  status: string;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  type: string;
  lead: { assigned_to_id: string | null } | null;
};
type ProfileRow = { id: string; display_name: string | null; role: string };

let leadsTable: LeadRow[] = [];
let followUpsTable: FollowUpRow[] = [];
let profilesTable: ProfileRow[] = [];
let currentProfile: { id: string; role: "admin" | "staff"; displayName: string | null } = { id: "admin-1", role: "admin", displayName: "Admin" };

// A query-builder mock that actually applies .gte/.lt/.eq filters against
// `created_at` (and assigned_to_id) rather than ignoring them -- needed
// here specifically because getReportsData issues two leads queries with
// different bounds (current period, previous period) against the same
// seeded table, and a dumb "always return everything" mock couldn't tell
// them apart.
function dateFilteredBuilder<T extends { created_at: string; assigned_to_id?: string | null }>(rows: T[]) {
  let gteVal: string | undefined;
  let ltVal: string | undefined;
  let eqAssigned: string | undefined;
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = vi.fn(chain);
  b.is = vi.fn(chain);
  b.not = vi.fn(chain);
  b.order = vi.fn(chain);
  b.eq = vi.fn((col: string, val: string) => {
    if (col === "assigned_to_id") eqAssigned = val;
    return b;
  });
  b.gte = vi.fn((_col: string, val: string) => {
    gteVal = val;
    return b;
  });
  b.lt = vi.fn((_col: string, val: string) => {
    ltVal = val;
    return b;
  });
  b.then = (resolve: (v: { data: T[]; error: null }) => unknown) => {
    let filtered = rows;
    if (gteVal) filtered = filtered.filter((r) => r.created_at >= gteVal!);
    if (ltVal) filtered = filtered.filter((r) => r.created_at < ltVal!);
    if (eqAssigned) filtered = filtered.filter((r) => r.assigned_to_id === eqAssigned);
    return Promise.resolve({ data: filtered, error: null }).then(resolve);
  };
  return b;
}

function staticBuilder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "order"]) b[m] = vi.fn(chain);
  b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === "leads") return dateFilteredBuilder(leadsTable);
      if (table === "follow_ups") return dateFilteredBuilder(followUpsTable as unknown as (FollowUpRow & { assigned_to_id?: null })[]);
      if (table === "profiles") return staticBuilder(profilesTable);
      return staticBuilder([]);
    },
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => currentProfile }));

import { getReportsData } from "@/lib/reports";

const lead = (over: Partial<LeadRow>): LeadRow => ({
  id: "l1",
  status: "new",
  job_value: null,
  quotation_amount: null,
  assigned_to_id: null,
  qualification_score: null,
  service_required: null,
  lost_reason: null,
  source: null,
  created_at: "2026-09-27T10:00:00.000Z",
  ...over,
});

describe("getReportsData -- period resolution and scoping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z")); // 15:30 IST on the 27th
    leadsTable = [];
    followUpsTable = [];
    profilesTable = [];
    currentProfile = { id: "admin-1", role: "admin", displayName: "Admin" };
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to last30 and resolves the real period bounds", async () => {
    const data = await getReportsData({});
    expect(data.period).toEqual({ preset: "last30", from: "2026-08-29", to: "2026-09-27" });
  });

  it("only counts leads whose created_at falls inside the selected period", async () => {
    leadsTable = [
      lead({ id: "in", created_at: "2026-09-27T05:00:00.000Z" }), // today, IST
      lead({ id: "out", created_at: "2026-01-01T05:00:00.000Z" }), // long before last30
    ];
    const data = await getReportsData({ datePreset: "today" });
    expect(data.pipelineDistribution.totalLeads).toBe(1);
  });

  it("staff caller is scoped to their own assigned_to_id", async () => {
    currentProfile = { id: "staff-1", role: "staff", displayName: "Staff One" };
    leadsTable = [
      lead({ id: "mine", assigned_to_id: "staff-1", created_at: "2026-09-27T05:00:00.000Z" }),
      lead({ id: "other", assigned_to_id: "staff-2", created_at: "2026-09-27T05:00:00.000Z" }),
    ];
    const data = await getReportsData({ datePreset: "today" });
    expect(data.pipelineDistribution.totalLeads).toBe(1);
  });
});

describe("getReportsData -- executive summary period-over-period comparison", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    followUpsTable = [];
    profilesTable = [];
    currentProfile = { id: "admin-1", role: "admin", displayName: "Admin" };
  });
  afterEach(() => vi.useRealTimers());

  it("compares the current preset period against the equal-length period immediately before it", async () => {
    leadsTable = [
      // "today" period: 2026-09-27 only.
      lead({ id: "c1", created_at: "2026-09-27T05:00:00.000Z" }),
      lead({ id: "c2", created_at: "2026-09-27T08:00:00.000Z", status: "won", job_value: 100000 }),
      // previous period for "today" is exactly 2026-09-26.
      lead({ id: "p1", created_at: "2026-09-26T05:00:00.000Z" }),
    ];

    const data = await getReportsData({ datePreset: "today" });

    expect(data.executiveSummary.totalLeads).toEqual({ current: 2, previous: 1, changePct: 100 });
    expect(data.executiveSummary.wonCount).toEqual({ current: 1, previous: 0, changePct: null });
    expect(data.executiveSummary.wonValue.current).toBe(100000);
  });

  it("computes pipeline value from open-status leads only, job_value falling back to quotation_amount", async () => {
    leadsTable = [
      lead({ id: "open1", status: "quotation", job_value: null, quotation_amount: 50000, created_at: "2026-09-27T05:00:00.000Z" }),
      lead({ id: "won1", status: "won", job_value: 200000, created_at: "2026-09-27T05:00:00.000Z" }), // not open, excluded
    ];
    const data = await getReportsData({ datePreset: "today" });
    expect(data.executiveSummary.pipelineValue).toBe(50000);
  });

  it("averageWonValue and overallWonRate are null, not NaN, when there is no data", async () => {
    leadsTable = [];
    const data = await getReportsData({ datePreset: "today" });
    expect(data.executiveSummary.averageWonValue).toBeNull();
    expect(data.executiveSummary.overallWonRate).toBeNull();
  });
});

describe("getReportsData -- lead source breakdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    followUpsTable = [];
    profilesTable = [];
    currentProfile = { id: "admin-1", role: "admin", displayName: "Admin" };
  });
  afterEach(() => vi.useRealTimers());

  it("groups by real source values, buckets null as 'other', with real percentages", async () => {
    leadsTable = [
      lead({ id: "a", source: "whatsapp", created_at: "2026-09-27T05:00:00.000Z" }),
      lead({ id: "b", source: "whatsapp", created_at: "2026-09-27T05:00:00.000Z" }),
      lead({ id: "c", source: null, created_at: "2026-09-27T05:00:00.000Z" }),
    ];
    const data = await getReportsData({ datePreset: "today" });
    const whatsapp = data.leadSourceBreakdown.find((s) => s.source === "whatsapp")!;
    const other = data.leadSourceBreakdown.find((s) => s.source === "other")!;
    expect(whatsapp).toMatchObject({ count: 2, percentage: 66.7, label: "WhatsApp" });
    expect(other.count).toBe(1);
  });
});

describe("getReportsData -- trend by day", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    followUpsTable = [];
    profilesTable = [];
    currentProfile = { id: "admin-1", role: "admin", displayName: "Admin" };
  });
  afterEach(() => vi.useRealTimers());

  it("tallies leads by business-day and current status, one point per day in range", async () => {
    leadsTable = [
      lead({ id: "a", status: "new", created_at: "2026-09-27T05:00:00.000Z" }),
      lead({ id: "b", status: "won", created_at: "2026-09-26T05:00:00.000Z" }),
    ];
    const data = await getReportsData({ datePreset: "last7" });

    expect(data.trend).toHaveLength(7);
    const day27 = data.trend.find((p) => p.date === "2026-09-27")!;
    const day26 = data.trend.find((p) => p.date === "2026-09-26")!;
    expect(day27.new).toBe(1);
    expect(day26.won).toBe(1);
  });
});

describe("getReportsData -- unauthenticated caller", () => {
  it("returns empty data rather than throwing", async () => {
    currentProfile = null as unknown as typeof currentProfile;
    const data = await getReportsData({});
    expect(data.pipelineDistribution.totalLeads).toBe(0);
    expect(data.staffPerformance).toEqual([]);
  });
});
