import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { queryLeads } from "./leads-query";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

// One query builder per call to .from("leads") -- records every chained
// filter call so tests can assert on exactly what was sent to PostgREST,
// same "minimal chainable/thenable stand-in" convention as this project's
// other Supabase-backed tests.
function makeBuilder(result: QueryResult, calls: { method: string; args: unknown[] }[]) {
  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const method of ["select", "is", "order", "limit", "eq", "ilike", "gte", "lt"]) {
    builder[method] = vi.fn(record(method));
  }
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function createFakeSupabase(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const from = vi.fn(() => makeBuilder(result, calls));
  return { stub: { from } as unknown as SupabaseClient<Database>, calls };
}

const LEAD_ROW = {
  id: "abcdef12-0000-0000-0000-000000000000",
  location: "Kollam",
  service_required: "Gypsum plastering",
  project_type: "Residential",
  assigned_to_id: "staff-1",
  status: "qualified",
  created_at: "2026-10-31T06:00:00.000Z",
};

describe("queryLeads", () => {
  it("returns privacy-safe summaries -- no phone or customer_name", async () => {
    const { stub } = createFakeSupabase({ data: [LEAD_ROW] });

    const result = await queryLeads(stub, {});

    expect(result).toEqual([
      { reference: "Lead ABCDEF12 — Kollam — Gypsum plastering", crmUrl: "/leads/abcdef12-0000-0000-0000-000000000000", status: "qualified", assignedToId: "staff-1", createdAt: "2026-10-31T06:00:00.000Z" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/phone|customer_name/i);
  });

  it("applies a valid status filter", async () => {
    const { stub, calls } = createFakeSupabase({ data: [] });
    await queryLeads(stub, { status: "won" });
    expect(calls).toContainEqual({ method: "eq", args: ["status", "won"] });
  });

  it("ignores an invalid status rather than erroring", async () => {
    const { stub, calls } = createFakeSupabase({ data: [] });
    await queryLeads(stub, { status: "not-a-real-status" });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status")).toBe(false);
  });

  it("applies a location filter, stripped of PostgREST-meaningful characters", async () => {
    const { stub, calls } = createFakeSupabase({ data: [] });
    await queryLeads(stub, { location: "Kollam, (test)" });
    expect(calls).toContainEqual({ method: "ilike", args: ["location", "%Kollam test%"] });
  });

  it("applies an assignedToId filter", async () => {
    const { stub, calls } = createFakeSupabase({ data: [] });
    await queryLeads(stub, { assignedToId: "staff-9" });
    expect(calls).toContainEqual({ method: "eq", args: ["assigned_to_id", "staff-9"] });
  });

  it("resolves a datePreset into a gte/lt range", async () => {
    const { stub, calls } = createFakeSupabase({ data: [] });
    await queryLeads(stub, { datePreset: "today" });
    expect(calls.some((c) => c.method === "gte" && c.args[0] === "created_at")).toBe(true);
    expect(calls.some((c) => c.method === "lt" && c.args[0] === "created_at")).toBe(true);
  });

  it("ignores an unrecognised datePreset rather than erroring", async () => {
    const { stub, calls } = createFakeSupabase({ data: [] });
    await queryLeads(stub, { datePreset: "not-a-real-preset" });
    expect(calls.some((c) => c.method === "gte")).toBe(false);
  });

  it("returns an empty array when the query returns no rows", async () => {
    const { stub } = createFakeSupabase({ data: null });
    expect(await queryLeads(stub, {})).toEqual([]);
  });
});
