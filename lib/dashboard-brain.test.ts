import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getMyDutyQueue() decides "overdue" vs "due today" from the business (IST)
// day. Table-routed mock: follow_ups and leads each get their own seedable
// row array, everything else stays empty unless a test overrides it.
type FollowUpRow = { id: string; lead_id: string; type: string; due_date: string; due_time: string | null; notes: null; lead: unknown };
type LeadRow = { id: string; customer_name: string; phone: string; status: string; created_at: string; assigned: null };

let followUps: FollowUpRow[] = [];
let leadsTable: LeadRow[] = [];

function builder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "in", "is", "lt", "order", "limit", "neq"]) b[m] = vi.fn(chain);
  b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => builder(table === "follow_ups" ? followUps : table === "leads" ? leadsTable : []),
  }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => ({ id: "admin-1", role: "admin" }) }));

const getUncontactedLeadsMock = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/leads", () => ({ getUncontactedLeads: () => getUncontactedLeadsMock() }));

const getUnansweredConversationsMock = vi.fn(async () => [] as unknown[]);
vi.mock("@/lib/conversations", () => ({
  getUnansweredConversations: () => getUnansweredConversationsMock(),
}));

import { getMyDutyQueue } from "@/lib/dashboard-brain";

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
