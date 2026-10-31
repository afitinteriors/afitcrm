import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { bucketByOverdue, findUnrespondedLeads, type UnrespondedLead } from "./response-timer";

// Same minimal chainable/thenable query-builder stand-in used across this
// project's other Supabase-backed tests (lib/actions/leads.test.ts etc.),
// extended with .in() for the lead_id/conversation_id filters this module
// needs.
type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.not = vi.fn(chain);
  builder.lte = vi.fn(chain);
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
  return { stub: { from } as unknown as SupabaseClient<Database>, from };
}

function lead(overrides: Partial<UnrespondedLead> = {}): UnrespondedLead {
  return {
    id: "lead-1",
    customer_name: "Rahul K.",
    phone: "+919999999999",
    assigned_to_id: "staff-1",
    created_at: "2026-10-31T10:00:00.000Z",
    ...overrides,
  };
}

describe("bucketByOverdue -- R-LEAD-003 (docs/BLUEPRINT_V1.md Section 8)", () => {
  const now = new Date("2026-10-31T10:20:00.000Z"); // 20 minutes after the lead above

  it("a lead younger than 15 minutes is in neither bucket", () => {
    const young = lead({ created_at: "2026-10-31T10:10:00.000Z" }); // 10 min old
    expect(bucketByOverdue([young], now)).toEqual({ overdueStaff: [], overdueOwner: [] });
  });

  it("a lead between 15 and 30 minutes old is only in the staff bucket", () => {
    const mid = lead({ created_at: "2026-10-31T10:00:00.000Z" }); // 20 min old
    expect(bucketByOverdue([mid], now)).toEqual({ overdueStaff: [mid], overdueOwner: [] });
  });

  it("a lead 30+ minutes old is in BOTH buckets", () => {
    const old = lead({ created_at: "2026-10-31T09:45:00.000Z" }); // 35 min old
    expect(bucketByOverdue([old], now)).toEqual({ overdueStaff: [old], overdueOwner: [old] });
  });

  it("exactly 15 and exactly 30 minutes are inclusive boundaries", () => {
    const fifteen = lead({ id: "l15", created_at: "2026-10-31T10:05:00.000Z" }); // exactly 15 min
    const thirty = lead({ id: "l30", created_at: "2026-10-31T09:50:00.000Z" }); // exactly 30 min
    const result = bucketByOverdue([fifteen, thirty], now);
    expect(result.overdueStaff.map((l) => l.id)).toEqual(["l15", "l30"]);
    expect(result.overdueOwner.map((l) => l.id)).toEqual(["l30"]);
  });
});

describe("findUnrespondedLeads", () => {
  it("returns [] immediately when there are no overdue candidate leads, without querying call_logs/conversations", async () => {
    const { stub, from } = createFakeSupabase({ leads: [{ data: [], error: null }] });
    const result = await findUnrespondedLeads(stub, new Date("2026-10-31T10:20:00.000Z"));
    expect(result).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("leads");
  });

  it("returns a candidate with no call_logs and no conversation at all", async () => {
    const candidate = lead();
    const { stub } = createFakeSupabase({
      leads: [{ data: [candidate], error: null }],
      call_logs: [{ data: [], error: null }],
      conversations: [{ data: [], error: null }],
    });
    const result = await findUnrespondedLeads(stub, new Date("2026-10-31T10:20:00.000Z"));
    expect(result).toEqual([candidate]);
  });

  it("excludes a candidate with a resolved call_logs row", async () => {
    const candidate = lead();
    const { stub } = createFakeSupabase({
      leads: [{ data: [candidate], error: null }],
      call_logs: [{ data: [{ lead_id: candidate.id }], error: null }],
      conversations: [{ data: [], error: null }],
    });
    const result = await findUnrespondedLeads(stub, new Date("2026-10-31T10:20:00.000Z"));
    expect(result).toEqual([]);
  });

  it("excludes a candidate whose conversation has an outbound message", async () => {
    const candidate = lead();
    const { stub } = createFakeSupabase({
      leads: [{ data: [candidate], error: null }],
      call_logs: [{ data: [], error: null }],
      conversations: [{ data: [{ id: "conv-1", lead_id: candidate.id }], error: null }],
      messages: [{ data: [{ conversation_id: "conv-1" }], error: null }],
    });
    const result = await findUnrespondedLeads(stub, new Date("2026-10-31T10:20:00.000Z"));
    expect(result).toEqual([]);
  });

  it("still includes a candidate whose conversation has only inbound messages (no outbound reply)", async () => {
    const candidate = lead();
    const { stub } = createFakeSupabase({
      leads: [{ data: [candidate], error: null }],
      call_logs: [{ data: [], error: null }],
      conversations: [{ data: [{ id: "conv-1", lead_id: candidate.id }], error: null }],
      messages: [{ data: [], error: null }], // the .eq("direction","outbound") filter leaves nothing
    });
    const result = await findUnrespondedLeads(stub, new Date("2026-10-31T10:20:00.000Z"));
    expect(result).toEqual([candidate]);
  });
});
