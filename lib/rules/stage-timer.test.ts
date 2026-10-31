import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { bucketStageOverdue, findStageTrackedLeads, overdueStageDays, type StageTrackedLead } from "./stage-timer";

type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.in = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function createFakeSupabase(result: QueryResult) {
  const from = vi.fn(() => makeBuilder(result));
  return { stub: { from } as unknown as SupabaseClient<Database>, from };
}

function lead(overrides: Partial<StageTrackedLead> = {}): StageTrackedLead {
  return {
    id: "lead-1",
    customer_name: "Rahul K.",
    phone: "+919999999999",
    assigned_to_id: "staff-1",
    status: "qualified",
    status_changed_at: "2026-10-29T10:00:00.000Z",
    site_visit_date: null,
    quotation_amount: null,
    ...overrides,
  };
}

describe("overdueStageDays -- R-STAGE-002 (docs/BLUEPRINT_V1.md Section 8)", () => {
  const now = new Date("2026-10-31T10:00:00.000Z"); // exactly 2 days after the lead above's status_changed_at

  it("qualified: 0 before the 2-day limit, positive once past it", () => {
    const young = lead({ status_changed_at: "2026-10-30T10:00:00.000Z" }); // 1 day old
    expect(overdueStageDays(young, now)).toBe(0);

    const overdue = lead({ status_changed_at: "2026-10-28T10:00:00.000Z" }); // 3 days old, 1 day over
    expect(overdueStageDays(overdue, now)).toBeCloseTo(1, 5);
  });

  it("negotiation: 7-day limit", () => {
    const young = lead({ status: "negotiation", status_changed_at: "2026-10-26T10:00:00.000Z" }); // 5 days
    expect(overdueStageDays(young, now)).toBe(0);

    const overdue = lead({ status: "negotiation", status_changed_at: "2026-10-22T10:00:00.000Z" }); // 9 days, 2 over
    expect(overdueStageDays(overdue, now)).toBeCloseTo(2, 5);
  });

  it("site_visit: measured from site_visit_date, not status_changed_at", () => {
    const noDate = lead({ status: "site_visit", status_changed_at: "2026-10-01T10:00:00.000Z" });
    expect(overdueStageDays(noDate, now)).toBe(0); // nothing to measure against

    const recentVisit = lead({ status: "site_visit", site_visit_date: "2026-10-30T10:00:00.000Z" }); // 1 day ago
    expect(overdueStageDays(recentVisit, now)).toBe(0);

    const overdueVisit = lead({ status: "site_visit", site_visit_date: "2026-10-27T10:00:00.000Z" }); // 4 days ago, 2 over
    expect(overdueStageDays(overdueVisit, now)).toBeCloseTo(2, 5);
  });

  it("site_visit: a quotation already sent clears the overdue flag even past the limit", () => {
    const quoted = lead({ status: "site_visit", site_visit_date: "2026-10-20T10:00:00.000Z", quotation_amount: 50000 });
    expect(overdueStageDays(quoted, now)).toBe(0);
  });

  it("other statuses (contacted, quotation) have no limit at all", () => {
    expect(overdueStageDays(lead({ status: "contacted", status_changed_at: "2026-01-01T00:00:00.000Z" }), now)).toBe(0);
    expect(overdueStageDays(lead({ status: "quotation", status_changed_at: "2026-01-01T00:00:00.000Z" }), now)).toBe(0);
  });
});

describe("bucketStageOverdue", () => {
  const now = new Date("2026-10-31T10:00:00.000Z");

  it("not overdue at all -> neither bucket", () => {
    const l = lead({ status_changed_at: "2026-10-30T10:00:00.000Z" }); // 1 day
    expect(bucketStageOverdue([l], now)).toEqual({ overdueStaff: [], overdueOwner: [] });
  });

  it("just past the limit (< 1 day grace) -> staff only", () => {
    const l = lead({ status_changed_at: "2026-10-28T12:00:00.000Z" }); // 2.9 days, 0.9 over
    const result = bucketStageOverdue([l], now);
    expect(result.overdueStaff).toEqual([l]);
    expect(result.overdueOwner).toEqual([]);
  });

  it("past the limit plus the owner-escalation grace -> both buckets", () => {
    const l = lead({ status_changed_at: "2026-10-27T10:00:00.000Z" }); // 4 days, 2 over
    const result = bucketStageOverdue([l], now);
    expect(result.overdueStaff).toEqual([l]);
    expect(result.overdueOwner).toEqual([l]);
  });
});

describe("findStageTrackedLeads", () => {
  it("queries only the tracked statuses and unmerged leads", async () => {
    const rows = [lead()];
    const { stub, from } = createFakeSupabase({ data: rows, error: null });
    const result = await findStageTrackedLeads(stub);
    expect(result).toEqual(rows);
    expect(from).toHaveBeenCalledWith("leads");
  });

  it("returns [] when the query errors or finds nothing", async () => {
    const { stub } = createFakeSupabase({ data: null, error: { message: "boom" } });
    expect(await findStageTrackedLeads(stub)).toEqual([]);
  });
});
