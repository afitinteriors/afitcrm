import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression tests for getUnansweredConversations() -- the canonical source
// of the "customer messaged and hasn't had a reply" signal (consumed by
// getMyDutyQueue() for the Dashboard, /today and Staff Home). A conversation
// on a closed lead must never surface as work.

type Result = { data: unknown; error: null | { message: string } };
let tables: Record<string, Result> = {};

function builder(result: Result) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = vi.fn(chain);
  b.order = vi.fn(chain);
  b.eq = vi.fn(chain);
  b.in = vi.fn(chain);
  b.then = (resolve: (v: Result) => unknown) => Promise.resolve(result).then(resolve);
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (table: string) => builder(tables[table] ?? { data: [], error: null }) }),
}));
vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => ({ id: "staff-1", role: "staff" }) }));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: vi.fn() }));

import { getUnansweredConversations } from "@/lib/conversations";

function world(convs: Array<{ id: string; status: string | null }>) {
  tables = {
    // Latest message per conversation is inbound -> every one is "unanswered".
    messages: {
      data: convs.map((c, i) => ({ conversation_id: c.id, direction: "inbound", created_at: `2026-09-25T0${i}:00:00Z` })),
      error: null,
    },
    conversations: {
      data: convs.map((c) => ({
        id: c.id,
        wa_id: `9190000000${c.id.length}`,
        lead: c.status === null ? null : { id: `lead-${c.id}`, customer_name: c.id, status: c.status, assigned: null },
      })),
      error: null,
    },
  };
}

describe("getUnansweredConversations -- closed leads are not work", () => {
  beforeEach(() => {
    tables = {};
  });

  it("excludes an unanswered conversation whose lead is LOST", async () => {
    world([{ id: "lost-conv", status: "lost" }]);
    expect(await getUnansweredConversations()).toEqual([]);
  });

  it("excludes an unanswered conversation whose lead is WON", async () => {
    world([{ id: "won-conv", status: "won" }]);
    expect(await getUnansweredConversations()).toEqual([]);
  });

  it("still includes unanswered conversations on OPEN leads, and ones not yet linked to any lead", async () => {
    world([
      { id: "new-conv", status: "new" },
      { id: "quote-conv", status: "quotation" },
      { id: "orphan-conv", status: null },
      { id: "lost-conv", status: "lost" },
      { id: "won-conv", status: "won" },
    ]);

    const result = await getUnansweredConversations();

    expect(result.map((c) => c.id).sort()).toEqual(["new-conv", "orphan-conv", "quote-conv"]);
    expect(result.every((c) => typeof c.lastInboundAt === "string")).toBe(true);
  });
});
