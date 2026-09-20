import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Regression tests for the concurrent lead-creation race (two overlapping
// webhook deliveries for one brand-new phone number both passing the
// "no active lead yet" lookup and both inserting).
//
// The fake database below is stateful and models the database rules that
// matter, mirroring supabase/migrations/20260920140000_leads_active_phone_unique_idx.sql:
//   * leads: at most one ACTIVE (merged_into_id IS NULL) lead per phone among
//     leads created after the migration; leads that pre-date it ("legacy")
//     are exempt, exactly as in the migration's predicate; merged leads never
//     count;
//   * messages.wa_message_id is UNIQUE (the existing message-level dedup);
//   * conversations have NO uniqueness (matches production today), so the
//     conversation-level race is deliberately still reproducible.
// Barriers hold an insert until BOTH requests have reached it, which forces
// the exact interleaving that caused the bug (both lookups happen before
// either insert). These tests prove the application handles the database's
// rejection correctly; the atomicity itself is PostgreSQL's guarantee, which
// the migration SQL was verified against separately on a real Postgres engine.

vi.mock("@/lib/automations/trigger", () => ({
  triggerAutomationForMessage: vi.fn().mockResolvedValue({ runId: null, status: "no_match" }),
}));

import { createOrLinkLeadForConversation, type CreateOrLinkLeadContext } from "@/lib/automations/crm-actions";
import { ingestInboundMessage } from "./ingest";
import { parseWabisMessage } from "./parse-wabis";

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };
type DbResult = { data: unknown; error: DbError | null };
type Table = "leads" | "conversations" | "messages";

class Barrier {
  private arrived = 0;
  private waiters: Array<() => void> = [];
  constructor(private expected: number) {}
  async wait(): Promise<void> {
    this.arrived += 1;
    if (this.arrived >= this.expected) {
      this.waiters.forEach((release) => release());
      this.waiters = [];
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }
}

class MemoryDb {
  leads: Row[] = [];
  conversations: Row[] = [];
  messages: Row[] = [];
  barriers: Partial<Record<Table, Barrier>> = {};
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  // Pre-existing (pre-migration) row: exempt from the partial unique index.
  seedLead(row: Row): Row {
    const lead = { id: this.nextId("lead"), merged_into_id: null, ...row, __legacy: true };
    this.leads.push(lead);
    return lead;
  }

  seedConversation(id: string): Row {
    const conversation = { id, lead_id: null };
    this.conversations.push(conversation);
    return conversation;
  }

  activeLeads(): Row[] {
    return this.leads.filter((l) => (l.merged_into_id ?? null) === null);
  }

  private rows(table: Table): Row[] {
    return this[table];
  }

  private async insert(table: Table, payload: Row): Promise<DbResult> {
    const barrier = this.barriers[table];
    if (barrier) await barrier.wait();

    if (table === "leads") {
      const isActive = (payload.merged_into_id ?? null) === null;
      const conflict =
        isActive &&
        this.leads.some(
          (r) => r.__legacy !== true && (r.merged_into_id ?? null) === null && r.phone === payload.phone
        );
      if (conflict) {
        return {
          data: null,
          error: {
            code: "23505",
            message: 'duplicate key value violates unique constraint "leads_active_phone_unique_idx"',
          },
        };
      }
    }
    if (table === "messages" && payload.wa_message_id != null) {
      if (this.messages.some((r) => r.wa_message_id === payload.wa_message_id)) {
        return {
          data: null,
          error: { code: "23505", message: 'duplicate key value violates unique constraint "messages_wa_message_id_key"' },
        };
      }
    }

    const row: Row = { id: this.nextId(table), merged_into_id: null, ...payload, __legacy: false };
    this.rows(table).push(row);
    return { data: { id: row.id }, error: null };
  }

  client(): SupabaseClient<Database> {
    const from = (table: string) => this.builder(table as Table);
    return { from } as unknown as SupabaseClient<Database>;
  }

  private builder(table: Table) {
    const state: { op: "select" | "insert" | "update"; payload: Row; filters: Array<{ col: string; val: unknown }> } = {
      op: "select",
      payload: {},
      filters: [],
    };
    const matches = (row: Row) => state.filters.every((f) => (row[f.col] ?? null) === f.val);
    const builder: Record<string, unknown> = {};

    const run = async (opts: { limit?: number; single?: boolean; maybe?: boolean }): Promise<DbResult> => {
      if (state.op === "insert") return this.insert(table, state.payload);
      if (state.op === "update") {
        this.rows(table)
          .filter(matches)
          .forEach((row) => Object.assign(row, state.payload));
        return { data: null, error: null };
      }
      // select: snapshot at call time (before any awaited barrier elsewhere)
      const found = this.rows(table)
        .filter(matches)
        .map((r) => ({ ...r }));
      if (opts.single || opts.maybe) {
        if (found.length > 1) return { data: null, error: { message: "multiple rows" } };
        if (found.length === 0) {
          return opts.single ? { data: null, error: { code: "PGRST116", message: "no rows" } } : { data: null, error: null };
        }
        return { data: found[0], error: null };
      }
      return { data: opts.limit ? found.slice(0, opts.limit) : found, error: null };
    };

    builder.select = () => builder; // projection is irrelevant to this fake
    builder.insert = (payload: Row) => {
      state.op = "insert";
      state.payload = payload;
      return builder;
    };
    builder.update = (payload: Row) => {
      state.op = "update";
      state.payload = payload;
      return builder;
    };
    builder.eq = (col: string, val: unknown) => {
      state.filters.push({ col, val });
      return builder;
    };
    builder.is = (col: string, val: unknown) => {
      state.filters.push({ col, val });
      return builder;
    };
    builder.limit = (n: number) => run({ limit: n });
    builder.single = () => run({ single: true });
    builder.maybeSingle = () => run({ maybe: true });
    builder.then = (resolve: (value: DbResult) => unknown, reject?: (reason: unknown) => unknown) =>
      run({}).then(resolve, reject);
    return builder;
  }
}

function context(overrides: Partial<CreateOrLinkLeadContext> = {}): CreateOrLinkLeadContext {
  return {
    conversationId: "conv-1",
    phone: "9000000001",
    customerName: "First Caller",
    serviceName: "Gypsum Plaster",
    ...overrides,
  };
}

const CANONICAL = "+919000000001";

describe("createOrLinkLeadForConversation against a database enforcing one active lead per phone", () => {
  let db: MemoryDb;
  beforeEach(() => {
    db = new MemoryDb();
    db.seedConversation("conv-1");
    db.seedConversation("conv-2");
  });

  it("a normal new phone creates exactly one lead, stored in canonical form", async () => {
    const result = await createOrLinkLeadForConversation(db.client(), context());

    expect(result.created).toBe(true);
    expect(db.activeLeads()).toHaveLength(1);
    expect(db.activeLeads()[0].phone).toBe(CANONICAL);
  });

  it("an existing active phone reuses the existing lead instead of creating another", async () => {
    const first = await createOrLinkLeadForConversation(db.client(), context());
    const second = await createOrLinkLeadForConversation(db.client(), context({ conversationId: "conv-2" }));

    expect(second).toEqual({ leadId: first.leadId, created: false });
    expect(db.activeLeads()).toHaveLength(1);
  });

  it("different formattings of the same phone resolve to the same single active lead", async () => {
    const a = await createOrLinkLeadForConversation(db.client(), context({ phone: "9000000001" }));
    const b = await createOrLinkLeadForConversation(
      db.client(),
      context({ phone: "+91 90000 00001", conversationId: "conv-2" })
    );
    const c = await createOrLinkLeadForConversation(db.client(), context({ phone: "919000000001" }));

    expect(b.leadId).toBe(a.leadId);
    expect(c.leadId).toBe(a.leadId);
    expect(db.activeLeads()).toHaveLength(1);
  });

  it("CONCURRENT creation for the same canonical phone yields exactly ONE active lead (the loser reuses the winner)", async () => {
    db.barriers.leads = new Barrier(2); // both requests finish their lookups before either inserts

    const [a, b] = await Promise.all([
      createOrLinkLeadForConversation(db.client(), context({ phone: "9000000001", customerName: "Caller A" })),
      createOrLinkLeadForConversation(
        db.client(),
        context({ phone: "+91 90000 00001", customerName: "Caller B", conversationId: "conv-2" })
      ),
    ]);

    expect(db.activeLeads()).toHaveLength(1);
    expect(a.leadId).toBe(b.leadId);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1); // exactly one creator

    // Both conversations end up linked to the one lead; no orphan.
    expect(db.conversations.map((c) => c.lead_id)).toEqual([a.leadId, a.leadId]);

    // The winner's data is preserved -- the loser did not overwrite it.
    const winnerName = a.created ? "Caller A" : "Caller B";
    expect(db.activeLeads()[0].customer_name).toBe(winnerName);
  });

  it("a merged/retired lead does not block creating or linking the active lead", async () => {
    db.seedLead({ phone: CANONICAL, merged_into_id: "lead-elsewhere", customer_name: "Retired" });

    const result = await createOrLinkLeadForConversation(db.client(), context());

    expect(result.created).toBe(true);
    expect(db.activeLeads()).toHaveLength(1);
    expect(db.leads).toHaveLength(2);
    expect(db.leads.find((l) => l.merged_into_id === "lead-elsewhere")?.customer_name).toBe("Retired");
  });

  it("pre-existing historical duplicate leads are left exactly as they were", async () => {
    db.seedLead({ phone: "+919111111111", customer_name: "Old dup 1" });
    db.seedLead({ phone: "+919111111111", customer_name: "Old dup 2" });

    await createOrLinkLeadForConversation(db.client(), context()); // unrelated phone

    const oldDupes = db.leads.filter((l) => l.phone === "+919111111111");
    expect(oldDupes).toHaveLength(2);
    expect(oldDupes.map((l) => l.customer_name)).toEqual(["Old dup 1", "Old dup 2"]);
  });
});

describe("WABIS ingestion under duplicate concurrent deliveries", () => {
  const payload = {
    first_name: "Test",
    chat_id: "919000000001",
    postbackid: "",
    user_input_data: [] as unknown[],
    user_message: "Hello! Can I get more info about Gypsum plastering?",
    whatsapp_bot_username: "+91 7356877322",
  };

  let db: MemoryDb;
  beforeEach(() => {
    db = new MemoryDb();
  });

  function message() {
    const parsed = parseWabisMessage(payload);
    if (!parsed) throw new Error("test payload must parse");
    return parsed;
  }

  it("two simultaneous deliveries of one message create ONE active lead, ONE message, and no orphan conversation", async () => {
    // Force the production interleaving: both find no conversation and both
    // create one (conversations have no uniqueness), and both then try to
    // create the lead.
    db.barriers.conversations = new Barrier(2);
    db.barriers.leads = new Barrier(2);

    const [a, b] = await Promise.all([
      ingestInboundMessage(db.client(), message()),
      ingestInboundMessage(db.client(), message()),
    ]);

    // Existing message-level dedup still works: exactly one wins, one is a no-op duplicate.
    expect([a.status, b.status].sort()).toEqual(["duplicate", "ingested"]);
    expect(db.messages).toHaveLength(1);
    expect(String(db.messages[0].wa_message_id)).toMatch(/^wabis-fallback:/);

    // The bug being fixed: only one active lead may exist.
    expect(db.activeLeads()).toHaveLength(1);
    const leadId = db.activeLeads()[0].id;

    // Every conversation created by either delivery is linked to that lead.
    expect(db.conversations.length).toBeGreaterThanOrEqual(1);
    expect(db.conversations.every((c) => c.lead_id === leadId)).toBe(true);
  });

  it("does not overwrite an existing lead's data when duplicate deliveries arrive concurrently", async () => {
    const rich = db.seedLead({
      phone: "+919000000001",
      customer_name: "Established Customer",
      service_required: "Interior Design",
      assigned_to_id: "user-azhar",
      status: "quotation",
      job_value: 500000,
    });
    const before = { ...rich };
    db.barriers.conversations = new Barrier(2);

    await Promise.all([ingestInboundMessage(db.client(), message()), ingestInboundMessage(db.client(), message())]);

    expect(db.activeLeads()).toHaveLength(1); // no new lead at all
    expect(db.leads[0]).toEqual(before); // customer_name, service_required, assignee, status, job_value untouched
    expect(db.messages).toHaveLength(1);
    expect(db.conversations.every((c) => c.lead_id === rich.id)).toBe(true);
  });
});
