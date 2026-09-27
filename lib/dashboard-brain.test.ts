import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getMyDutyQueue() decides "overdue" vs "due today" from the business (IST)
// day. Table-routed mock: follow_ups and leads each get their own seedable
// row array, everything else stays empty unless a test overrides it.
type FollowUpRow = { id: string; lead_id: string; type: string; due_date: string; due_time: string | null; notes: null; lead: unknown };
type LeadRow = { id: string; customer_name: string; phone: string; status: string; created_at: string; assigned: null };

let followUps: FollowUpRow[] = [];
let leadsTable: LeadRow[] = [];
let profilesTable: unknown[] = [];
let currentProfile: { id: string; role: string } = { id: "admin-1", role: "admin" };

function builder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "in", "is", "lt", "gte", "not", "order", "limit", "neq"]) b[m] = vi.fn(chain);
  b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) =>
      builder(table === "follow_ups" ? followUps : table === "leads" ? leadsTable : table === "profiles" ? profilesTable : []),
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => currentProfile }));

const getUncontactedLeadsMock = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/leads", () => ({ getUncontactedLeads: () => getUncontactedLeadsMock() }));

const getUnansweredConversationsMock = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/conversations", () => ({
  getUnansweredConversations: () => getUnansweredConversationsMock(),
}));

import {
  getMyDutyQueue,
  getLeadsTrend,
  getRevenueOverview,
  getLeadSourceDistribution,
  getTeamPerformance,
  getTodaysSchedule,
} from "@/lib/dashboard-brain";

const lead = { customer_name: "C", phone: "+919000000000", status: "contacted", assigned: null };
const fu = (id: string, due_date: string, leadId = `lead-${id}`): FollowUpRow => ({
  id,
  lead_id: leadId,
  type: "call",
  due_date,
  due_time: null,
  notes: null,
  lead,
});

describe("dashboard duty queue uses the IST business day", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    followUps = [];
    leadsTable = [];
    getUncontactedLeadsMock.mockResolvedValue([]);
    getUnansweredConversationsMock.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("at 00:30 IST on the 22nd (still the 21st in UTC) the 21st is overdue and the 22nd is due today", async () => {
    vi.setSystemTime(new Date("2026-09-21T19:00:00Z"));
    followUps = [fu("a", "2026-09-21"), fu("b", "2026-09-22"), fu("c", "2026-09-23")];
    const queue = await getMyDutyQueue();
    const kinds = Object.fromEntries(queue.items.map((i) => [i.followUpId, i.reasonKind]));
    expect(kinds).toEqual({ a: "overdue_follow_up", b: "due_today_follow_up" });
    expect(queue.counts.overdue).toBe(1);
    expect(queue.counts.dueToday).toBe(1);
  });

  it("at 23:30 IST on the 21st the 21st is still due today", async () => {
    vi.setSystemTime(new Date("2026-09-21T18:00:00Z"));
    followUps = [fu("a", "2026-09-21"), fu("b", "2026-09-20")];
    const kinds = Object.fromEntries((await getMyDutyQueue()).items.map((i) => [i.followUpId, i.reasonKind]));
    expect(kinds).toEqual({ a: "due_today_follow_up", b: "overdue_follow_up" });
  });
});

// Duty Architecture Audit (2026-09), finding C(i): counts must be derived
// from the same deduped-by-lead array the displayed list uses, not from the
// raw per-signal source arrays -- otherwise a lead that trips more than one
// signal at once (the everyday shape of a fresh WhatsApp enquiry: it is
// simultaneously "unanswered" and "uncontacted") gets counted twice into
// stat tiles while the list correctly shows it once.
describe("getMyDutyQueue counts (regression: must match the deduped list, not raw per-signal counts)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-24T04:00:00Z")); // 2026-09-24 09:30 IST
    followUps = [];
    leadsTable = [];
    getUncontactedLeadsMock.mockResolvedValue([]);
    getUnansweredConversationsMock.mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("a lead that is both unanswered AND uncontacted appears once in items, and counts.unanswered/counts.uncontacted reflect exactly that one lead each -- not double-counted", async () => {
    getUnansweredConversationsMock.mockResolvedValue([
      { id: "conv-1", wa_id: "+919000000001", lastInboundAt: "2026-09-24T03:00:00Z", lead: { id: "lead-shared", customer_name: "Shared Lead", assigned: null } },
    ]);
    getUncontactedLeadsMock.mockResolvedValue([
      { id: "lead-shared", customer_name: "Shared Lead", phone: "+919000000001", status: "new", created_at: "2026-09-24T02:00:00Z", assigned: null },
    ]);

    const queue = await getMyDutyQueue();

    // Shown exactly once, under the higher-priority reason (unanswered beats uncontacted).
    const itemsForLead = queue.items.filter((i) => i.leadId === "lead-shared");
    expect(itemsForLead).toHaveLength(1);
    expect(itemsForLead[0].reasonKind).toBe("unanswered_conversation");

    // The old bug: counts.uncontacted was `uncontactedLeads.length` (raw,
    // pre-dedup) and would have been 1 here even though no "uncontacted"
    // card is actually shown anywhere for this lead.
    expect(queue.counts.unanswered).toBe(1);
    expect(queue.counts.uncontacted).toBe(0);
  });

  it("a lead that is both overdue AND has an unanswered conversation is counted once as overdue, not once in each tile", async () => {
    followUps = [fu("f1", "2026-09-20", "lead-shared")]; // overdue relative to 2026-09-24
    getUnansweredConversationsMock.mockResolvedValue([
      { id: "conv-1", wa_id: "+919000000001", lastInboundAt: "2026-09-24T03:00:00Z", lead: { id: "lead-shared", customer_name: "Shared Lead", assigned: null } },
    ]);

    const queue = await getMyDutyQueue();

    const itemsForLead = queue.items.filter((i) => i.leadId === "lead-shared");
    expect(itemsForLead).toHaveLength(1);
    expect(itemsForLead[0].reasonKind).toBe("overdue_follow_up");

    expect(queue.counts.overdue).toBe(1);
    expect(queue.counts.unanswered).toBe(0); // old bug: this was 1 (raw unanswered.length)
  });

  it("stalledPipeline count matches the deduped no_follow_up items, not the raw pre-dedup leads-without-follow-up array", async () => {
    leadsTable = [
      { id: "lead-quo", customer_name: "Quote Lead", phone: "+919000000002", status: "quotation", created_at: "2026-09-01T00:00:00Z", assigned: null },
    ];
    // Same lead is ALSO unanswered -- a higher-priority signal that wins the dedup.
    getUnansweredConversationsMock.mockResolvedValue([
      { id: "conv-2", wa_id: "+919000000002", lastInboundAt: "2026-09-24T03:00:00Z", lead: { id: "lead-quo", customer_name: "Quote Lead", assigned: null } },
    ]);

    const queue = await getMyDutyQueue();

    const itemsForLead = queue.items.filter((i) => i.leadId === "lead-quo");
    expect(itemsForLead).toHaveLength(1);
    expect(itemsForLead[0].reasonKind).toBe("unanswered_conversation");

    // Old bug: stalledPipeline was noFollowUpElsewhere.filter(...).length
    // (raw), which would have counted this lead even though it isn't shown
    // under "no follow-up" anywhere -- it's shown under "unanswered".
    expect(queue.counts.stalledPipeline).toBe(0);
  });

  it("two distinct leads each trip their own signal -- counts equal 2, nothing under- or over-counted when there is no overlap", async () => {
    followUps = [fu("f1", "2026-09-20", "lead-a"), fu("f2", "2026-09-20", "lead-b")];

    const queue = await getMyDutyQueue();

    expect(queue.items.filter((i) => i.reasonKind === "overdue_follow_up")).toHaveLength(2);
    expect(queue.counts.overdue).toBe(2);
  });
});

describe("getLeadsTrend -- Admin Dashboard reference chart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z")); // 15:30 IST on the 27th
    leadsTable = [];
    currentProfile = { id: "admin-1", role: "admin" };
  });
  afterEach(() => vi.useRealTimers());

  it("buckets by created_at's business day and current status, one point per day", async () => {
    leadsTable = [
      { id: "l1", customer_name: "A", phone: "+91", status: "new", created_at: "2026-09-27T09:00:00Z", assigned: null },
      { id: "l2", customer_name: "B", phone: "+91", status: "won", created_at: "2026-09-27T05:00:00Z", assigned: null },
      { id: "l3", customer_name: "C", phone: "+91", status: "contacted", created_at: "2026-09-26T10:00:00Z", assigned: null },
      // Outside the 7-day window -- must not appear in any bucket.
      { id: "l4", customer_name: "D", phone: "+91", status: "new", created_at: "2026-09-01T10:00:00Z", assigned: null },
    ] as unknown as LeadRow[];

    const trend = await getLeadsTrend(7);

    expect(trend).toHaveLength(7);
    expect(trend[trend.length - 1].date).toBe("2026-09-27");
    expect(trend[trend.length - 1].new).toBe(1);
    expect(trend[trend.length - 1].won).toBe(1);
    expect(trend[trend.length - 2].date).toBe("2026-09-26");
    expect(trend[trend.length - 2].contacted).toBe(1);
    const total = trend.reduce((sum, p) => sum + p.new + p.contacted + p.qualified + p.quotation + p.won, 0);
    expect(total).toBe(3); // l4 excluded
  });

  it("ignores statuses outside the reference's 5-series legend (site_visit/negotiation/lost)", async () => {
    leadsTable = [
      { id: "l1", customer_name: "A", phone: "+91", status: "site_visit", created_at: "2026-09-27T09:00:00Z", assigned: null },
      { id: "l2", customer_name: "B", phone: "+91", status: "lost", created_at: "2026-09-27T09:00:00Z", assigned: null },
    ] as unknown as LeadRow[];

    const trend = await getLeadsTrend(7);
    const total = trend.reduce((sum, p) => sum + p.new + p.contacted + p.qualified + p.quotation + p.won, 0);
    expect(total).toBe(0);
  });
});

describe("getRevenueOverview -- monthly quotation/won value", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
    leadsTable = [];
    currentProfile = { id: "admin-1", role: "admin" };
  });
  afterEach(() => vi.useRealTimers());

  it("sums quotation_amount and won job_value into the month each was last updated", async () => {
    leadsTable = [
      { id: "l1", customer_name: "A", phone: "+91", status: "quotation", quotation_amount: 100000, job_value: null, updated_at: "2026-09-10T10:00:00Z" },
      { id: "l2", customer_name: "B", phone: "+91", status: "won", quotation_amount: 200000, job_value: 250000, updated_at: "2026-09-15T10:00:00Z" },
      { id: "l3", customer_name: "C", phone: "+91", status: "quotation", quotation_amount: 50000, job_value: null, updated_at: "2026-08-05T10:00:00Z" },
    ] as unknown as LeadRow[];

    const overview = await getRevenueOverview(6);
    const sep = overview.find((p) => p.month === "2026-09")!;
    const aug = overview.find((p) => p.month === "2026-08")!;

    expect(sep.quotationValue).toBe(300000); // l1 + l2
    expect(sep.wonValue).toBe(250000); // l2's job_value, not its quotation_amount
    expect(aug.quotationValue).toBe(50000);
    expect(aug.wonValue).toBe(0);
  });

  it("falls back to quotation_amount for a won lead with no job_value recorded yet", async () => {
    leadsTable = [
      { id: "l1", customer_name: "A", phone: "+91", status: "won", quotation_amount: 80000, job_value: null, updated_at: "2026-09-10T10:00:00Z" },
    ] as unknown as LeadRow[];

    const overview = await getRevenueOverview(6);
    expect(overview.find((p) => p.month === "2026-09")!.wonValue).toBe(80000);
  });
});

describe("getLeadSourceDistribution -- real source values only", () => {
  beforeEach(() => {
    leadsTable = [];
    currentProfile = { id: "admin-1", role: "admin" };
  });

  it("groups by the real source column and labels via LEAD_SOURCE_LABELS", async () => {
    leadsTable = [
      { source: "whatsapp" },
      { source: "whatsapp" },
      { source: "meta_ads" },
      { source: null },
    ] as unknown as LeadRow[];

    const dist = await getLeadSourceDistribution();
    const whatsapp = dist.find((s) => s.source === "whatsapp")!;
    const other = dist.find((s) => s.source === "other")!;

    expect(whatsapp.count).toBe(2);
    expect(whatsapp.label).toBe("WhatsApp");
    expect(whatsapp.percentage).toBe(50);
    expect(other.count).toBe(1); // null source bucketed as "other", not dropped
  });

  it("returns an empty array rather than dividing by zero when there are no leads", async () => {
    leadsTable = [];
    expect(await getLeadSourceDistribution()).toEqual([]);
  });
});

describe("getTeamPerformance -- per-staff conversion, never NaN", () => {
  beforeEach(() => {
    profilesTable = [];
    leadsTable = [];
    currentProfile = { id: "admin-1", role: "admin" };
  });

  it("computes totalLeads/siteVisits/won/conversionPct per staff", async () => {
    profilesTable = [
      { id: "staff-1", display_name: "Azhar" },
      { id: "staff-2", display_name: "New Hire" },
    ];
    leadsTable = [
      { assigned_to_id: "staff-1", status: "won", site_visit_date: "2026-09-20T10:00:00Z" },
      { assigned_to_id: "staff-1", status: "new", site_visit_date: null },
      { assigned_to_id: "staff-1", status: "lost", site_visit_date: null },
    ] as unknown as LeadRow[];

    const rows = await getTeamPerformance();
    const azhar = rows.find((r) => r.staffId === "staff-1")!;
    const newHire = rows.find((r) => r.staffId === "staff-2")!;

    expect(azhar.totalLeads).toBe(3);
    expect(azhar.siteVisits).toBe(1);
    expect(azhar.won).toBe(1);
    expect(azhar.conversionPct).toBeCloseTo(33.3, 1);

    // A staff member with zero assigned leads gets 0%, not NaN.
    expect(newHire.totalLeads).toBe(0);
    expect(newHire.conversionPct).toBe(0);
  });
});

describe("getTodaysSchedule -- merged, time-sorted, real values only", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T05:00:00Z")); // 10:30 IST on the 27th
    followUps = [];
    leadsTable = [];
    currentProfile = { id: "admin-1", role: "admin" };
  });
  afterEach(() => vi.useRealTimers());

  it("merges today's pending follow-ups and today's site visits, sorted by time, untimed items last", async () => {
    followUps = [
      { id: "f1", lead_id: "lead-a", type: "call", due_date: "2026-09-27", due_time: "15:00:00", notes: null, lead: { customer_name: "A", assigned_to_id: null } },
      { id: "f2", lead_id: "lead-b", type: "meeting", due_date: "2026-09-27", due_time: null, notes: null, lead: { customer_name: "B", assigned_to_id: null } },
    ] as unknown as FollowUpRow[];
    leadsTable = [
      { id: "lead-c", customer_name: "C", phone: "+91", site_visit_date: "2026-09-27T05:30:00Z", assigned_to_id: null }, // 11:00 IST
    ] as unknown as LeadRow[];

    const schedule = await getTodaysSchedule();

    expect(schedule.map((s) => s.key)).toEqual(["site_visit:lead-c", "follow_up:f1", "follow_up:f2"]);
    expect(schedule[0].time).toBe("11:00");
    expect(schedule[1].time).toBe("15:00");
    expect(schedule[2].time).toBeNull();
  });

  it("a staff caller sees only their own items, an admin sees everyone's", async () => {
    followUps = [
      { id: "f1", lead_id: "lead-a", type: "call", due_date: "2026-09-27", due_time: "09:00:00", notes: null, lead: { customer_name: "A", assigned_to_id: "staff-1" } },
      { id: "f2", lead_id: "lead-b", type: "call", due_date: "2026-09-27", due_time: "09:00:00", notes: null, lead: { customer_name: "B", assigned_to_id: "staff-2" } },
    ] as unknown as FollowUpRow[];

    currentProfile = { id: "staff-1", role: "staff" };
    const staffView = await getTodaysSchedule();
    expect(staffView.map((s) => s.key)).toEqual(["follow_up:f1"]);

    currentProfile = { id: "admin-1", role: "admin" };
    const adminView = await getTodaysSchedule();
    expect(adminView.map((s) => s.key).sort()).toEqual(["follow_up:f1", "follow_up:f2"]);
  });
});
