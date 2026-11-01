import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getDailyReport } from "./daily-report";

// Same minimal chainable/thenable query-builder stand-in as
// lib/rules/response-timer.test.ts -- queues one result per call to
// .from(table), in call order, regardless of which filter methods chain
// off it.
type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.not = vi.fn(chain);
  builder.gte = vi.fn(chain);
  builder.lt = vi.fn(chain);
  builder.in = vi.fn(chain);
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
  return { from } as unknown as SupabaseClient<Database>;
}

const DATE = "2026-10-31";

describe("getDailyReport", () => {
  it("returns a zeroed row per staff member when nothing happened", async () => {
    const supabase = createFakeSupabase({
      profiles: [{ data: [{ id: "staff-1", display_name: "Azhar" }] }],
      leads: [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }],
      call_logs: [{ data: [] }],
    });

    const result = await getDailyReport(supabase, DATE);

    expect(result).toEqual([
      { staffId: "staff-1", displayName: "Azhar", leadsIn: 0, called: 0, respondedUnder15Min: 0, visitsFixed: 0, quotesSent: 0, won: 0, lost: 0 },
    ]);
  });

  it("counts leads in, called, quotes sent, won and lost per staff", async () => {
    const supabase = createFakeSupabase({
      profiles: [{ data: [{ id: "staff-1", display_name: "Azhar" }, { id: "staff-2", display_name: "Priya" }] }],
      leads: [
        // newLeads
        { data: [{ id: "lead-1", assigned_to_id: "staff-1", created_at: "2026-10-31T06:00:00.000Z" }] },
        // visitLeads
        { data: [] },
        // quotedLeads
        { data: [{ assigned_to_id: "staff-2" }] },
        // wonLeads
        { data: [{ assigned_to_id: "staff-1" }, { assigned_to_id: "staff-1" }] },
        // lostLeads
        { data: [{ assigned_to_id: "staff-2" }] },
      ],
      call_logs: [
        // resolved-today count
        { data: [{ caller_id: "staff-1" }] },
        // per-lead call rows for countRespondedUnder15Min (lead-1 only, no evidence)
        { data: [] },
      ],
      conversations: [{ data: [] }],
    });

    const result = await getDailyReport(supabase, DATE);

    expect(result.find((r) => r.staffId === "staff-1")).toMatchObject({ leadsIn: 1, called: 1, won: 2, lost: 0, quotesSent: 0 });
    expect(result.find((r) => r.staffId === "staff-2")).toMatchObject({ leadsIn: 0, called: 0, won: 0, lost: 1, quotesSent: 1 });
  });

  it("counts a visit as fixed by its visit date's calendar day, not when the lead was created", async () => {
    const supabase = createFakeSupabase({
      profiles: [{ data: [{ id: "staff-1", display_name: "Azhar" }] }],
      leads: [
        { data: [] }, // newLeads
        { data: [{ assigned_to_id: "staff-1", site_visit_date: "2026-10-31T09:00:00.000Z" }, { assigned_to_id: "staff-1", site_visit_date: "2026-11-05T09:00:00.000Z" }] }, // visitLeads
        { data: [] }, // quotedLeads
        { data: [] }, // wonLeads
        { data: [] }, // lostLeads
      ],
      call_logs: [{ data: [] }],
    });

    const result = await getDailyReport(supabase, DATE);

    expect(result[0].visitsFixed).toBe(1); // only the 2026-10-31 visit counts
  });

  it("credits a lead's assignee with respondedUnder15Min when a call was resolved within 15 minutes", async () => {
    const supabase = createFakeSupabase({
      profiles: [{ data: [{ id: "staff-1", display_name: "Azhar" }] }],
      leads: [
        { data: [{ id: "lead-1", assigned_to_id: "staff-1", created_at: "2026-10-31T06:00:00.000Z" }] }, // newLeads
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ],
      call_logs: [
        { data: [] }, // resolved-today count (unrelated to this assertion)
        { data: [{ lead_id: "lead-1", resolved_at: "2026-10-31T06:10:00.000Z" }] }, // 10 min later -- under 15
      ],
      conversations: [{ data: [] }],
    });

    const result = await getDailyReport(supabase, DATE);

    expect(result[0].respondedUnder15Min).toBe(1);
  });

  it("does not credit a response that arrived after 15 minutes", async () => {
    const supabase = createFakeSupabase({
      profiles: [{ data: [{ id: "staff-1", display_name: "Azhar" }] }],
      leads: [
        { data: [{ id: "lead-1", assigned_to_id: "staff-1", created_at: "2026-10-31T06:00:00.000Z" }] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ],
      call_logs: [{ data: [] }, { data: [{ lead_id: "lead-1", resolved_at: "2026-10-31T06:20:00.000Z" }] }], // 20 min later
      conversations: [{ data: [] }],
    });

    const result = await getDailyReport(supabase, DATE);

    expect(result[0].respondedUnder15Min).toBe(0);
  });

  it("returns an empty array for an invalid date string", async () => {
    const supabase = createFakeSupabase({});
    expect(await getDailyReport(supabase, "not-a-date")).toEqual([]);
  });
});
