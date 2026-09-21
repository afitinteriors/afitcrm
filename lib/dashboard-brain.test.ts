import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// getMyDutyQueue() decides "overdue" vs "due today" from the business (IST)
// day. Only the follow_ups query returns data; every other source is empty.
type Row = { id: string; lead_id: string; type: string; due_date: string; due_time: string | null; notes: null; lead: unknown };

let followUps: Row[] = [];

function builder(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "in", "is", "lt", "order", "limit", "neq"]) b[m] = vi.fn(chain);
  b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve);
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => builder(table === "follow_ups" ? followUps : []) }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => ({ id: "admin-1", role: "admin" }) }));
vi.mock("@/lib/leads", () => ({ getUncontactedLeads: async () => [] }));
vi.mock("@/lib/conversations", () => ({ getUnansweredConversations: async () => [] }));

import { getMyDutyQueue } from "@/lib/dashboard-brain";

const lead = { customer_name: "C", phone: "+919000000000", status: "contacted", assigned: null };
const fu = (id: string, due_date: string): Row => ({ id, lead_id: `lead-${id}`, type: "call", due_date, due_time: null, notes: null, lead });

describe("dashboard duty queue uses the IST business day", () => {
  beforeEach(() => vi.useFakeTimers());
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
