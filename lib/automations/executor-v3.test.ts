import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Step 7 synthetic end-to-end coverage for the v3 Automation Builder's
// runtime compatibility (Phase 6 of the Step 7 task). Everything here is a
// synthetic/local fixture -- no production data, no real Meta/WhatsApp
// calls (send-message.ts is mocked below), no real Supabase.
//
// This file proves the actual inbound pipeline end to end: ingest-shaped
// calls into triggerAutomationForMessage(), through real keyword matching
// (service_keywords), real session persistence (automation_sessions), the
// rewritten v3 graph walk (executor.ts), and the real CRM actions
// (crm-actions.ts) -- against a stateful in-memory fake database, the same
// pattern lib/whatsapp/lead-race.test.ts already established for exactly
// this kind of concurrent/resumable scenario.

vi.mock("@/lib/whatsapp/send-message", () => ({
  sendTextMessage: vi.fn(async (_phoneNumberId: string, _to: string, _text: string) => ({
    waMessageId: `wamid.synthetic-${Math.random().toString(36).slice(2)}`,
  })),
  sendMediaMessage: vi.fn(async (_phoneNumberId: string, _to: string, _mediaType: string, mediaId: string) => ({
    waMessageId: `wamid.synthetic-media-${mediaId}`,
  })),
  uploadMediaToMeta: vi.fn(async (_phoneNumberId: string, _bytes: Buffer, _mime: string) => ({
    mediaId: "meta-media-fresh",
  })),
  SendMessageError: class SendMessageError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { triggerAutomationForMessage } from "./trigger";
import { sendTextMessage } from "@/lib/whatsapp/send-message";

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };
type DbResult = { data: unknown; error: DbError | null };
type Table =
  | "leads"
  | "conversations"
  | "messages"
  | "profiles"
  | "services"
  | "service_keywords"
  | "automations"
  | "automation_sessions"
  | "automation_runs"
  | "automation_media"
  | "follow_ups";

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
  profiles: Row[] = [];
  services: Row[] = [];
  service_keywords: Row[] = [];
  automations: Row[] = [];
  automation_sessions: Row[] = [];
  automation_runs: Row[] = [];
  automation_media: Row[] = [];
  follow_ups: Row[] = [];
  barriers: Partial<Record<Table, Barrier>> = {};
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  private rows(table: Table): Row[] {
    return this[table];
  }

  seedConversation(id: string, row: Row = {}): Row {
    const conversation = { id, lead_id: null, wa_id: id, phone_number_id: "test", ...row };
    this.conversations.push(conversation);
    return conversation;
  }

  seedService(name: string, isActive = true): Row {
    const service = { id: this.nextId("service"), name, is_active: isActive };
    this.services.push(service);
    return service;
  }

  seedKeyword(serviceId: string, keyword: string, priority = 0): Row {
    const row = { id: this.nextId("kw"), service_id: serviceId, keyword, priority, is_active: true };
    this.service_keywords.push(row);
    return row;
  }

  seedAutomation(serviceId: string, actions: unknown, status: "draft" | "active" = "active"): Row {
    const row = { id: this.nextId("automation"), service_id: serviceId, status, actions };
    this.automations.push(row);
    return row;
  }

  seedStaff(id: string, role: "staff" | "admin" = "staff"): Row {
    const row = { id, role };
    this.profiles.push(row);
    return row;
  }

  seedMediaAsset(mediaType: string, metaMediaId?: string | null): Row {
    const id = this.nextId("media");
    const row = {
      id,
      media_type: mediaType,
      mime_type: mediaType === "document" ? "application/pdf" : "image/jpeg",
      storage_path: "synthetic/path",
      // Each fixture gets its own cached id by default -- a real Meta media
      // id is never reused across two different assets, and sendMediaMessage
      // is mocked to echo it back as the message's wa_message_id, which
      // must be unique per messages.wa_message_id's own real constraint.
      meta_media_id: metaMediaId === undefined ? `meta-media-cached-${id}` : metaMediaId,
    };
    this.automation_media.push(row);
    return row;
  }

  private async insert(table: Table, payload: Row): Promise<DbResult> {
    const barrier = this.barriers[table];
    if (barrier) await barrier.wait();

    if (table === "automation_sessions") {
      const conflict = this.automation_sessions.some(
        (r) => r.conversation_id === payload.conversation_id && (r.status === "active" || r.status === "handed_off")
      );
      if (conflict) {
        return {
          data: null,
          error: { code: "23505", message: 'duplicate key value violates unique constraint "automation_sessions_one_engaged_per_conversation"' },
        };
      }
    }
    if (table === "automation_runs" && payload.message_id != null) {
      if (this.automation_runs.some((r) => r.message_id === payload.message_id)) {
        return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "automation_runs_message_id_key"' } };
      }
    }
    if (table === "messages" && payload.wa_message_id != null) {
      if (this.messages.some((r) => r.wa_message_id === payload.wa_message_id)) {
        return { data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "messages_wa_message_id_key"' } };
      }
    }

    // Simulates Postgres' own behaviour for an omitted nullable column: it
    // defaults to SQL NULL, read back by PostgREST/Supabase as JS `null`,
    // never `undefined`. Without this, leads.qualification_notes (etc.)
    // would start as `undefined` here, and crm-actions.ts's own
    // `base === null` compare-and-swap checks (by design, matching real
    // column semantics) would never match -- a fixture bug, not a bug in
    // the function under test.
    const defaults = table === "leads" ? { qualification_notes: null, location: null, project_type: null, estimated_sqft: null, assigned_to_id: null, status: "new" } : {};
    const row: Row = { id: this.nextId(table), ...defaults, ...payload };
    this.rows(table).push(row);
    return { data: { id: row.id, ...row }, error: null };
  }

  client(): SupabaseClient<Database> {
    const from = (table: string) => this.builder(table as Table);
    const storage = { from: () => ({ download: async () => ({ data: new Blob(["synthetic"]), error: null }) }) };
    return { from, storage } as unknown as SupabaseClient<Database>;
  }

  private builder(table: Table) {
    const state: {
      op: "select" | "insert" | "update";
      payload: Row;
      filters: Array<{ col: string; val: unknown; negate?: boolean; isIn?: boolean }>;
    } = { op: "select", payload: {}, filters: [] };
    const matches = (row: Row) =>
      state.filters.every((f) => {
        if (f.isIn) return (f.val as unknown[]).includes(row[f.col] ?? null);
        return f.negate ? (row[f.col] ?? null) !== f.val : (row[f.col] ?? null) === f.val;
      });
    const builder: Record<string, unknown> = {};

    const run = async (opts: { limit?: number; single?: boolean; maybe?: boolean }): Promise<DbResult> => {
      if (state.op === "insert") return this.insert(table, state.payload);
      if (state.op === "update") {
        const matched = this.rows(table).filter(matches);
        matched.forEach((row) => Object.assign(row, state.payload));
        return { data: matched.map((r) => ({ ...r })), error: null };
      }
      const found = this.rows(table).filter(matches).map((r) => ({ ...r }));
      if (opts.single || opts.maybe) {
        if (found.length > 1) return { data: null, error: { message: "multiple rows" } };
        if (found.length === 0) {
          return opts.single ? { data: null, error: { code: "PGRST116", message: "no rows" } } : { data: null, error: null };
        }
        return { data: found[0], error: null };
      }
      return { data: opts.limit ? found.slice(0, opts.limit) : found, error: null };
    };

    builder.select = () => builder;
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
    builder.neq = (col: string, val: unknown) => {
      state.filters.push({ col, val, negate: true });
      return builder;
    };
    builder.is = (col: string, val: unknown) => {
      state.filters.push({ col, val });
      return builder;
    };
    builder.in = (col: string, val: unknown[]) => {
      state.filters.push({ col, val, isIn: true });
      return builder;
    };
    builder.limit = (n: number) => run({ limit: n });
    builder.single = () => run({ single: true });
    builder.maybeSingle = () => run({ maybe: true });
    builder.order = () => builder;
    builder.then = (resolve: (value: DbResult) => unknown, reject?: (reason: unknown) => unknown) => run({}).then(resolve, reject);
    return builder;
  }
}

// ---- The AFIT-shaped synthetic graph used across these scenarios ---------
// Mirrors the real AFIT workflow's shape (Welcome -> Video -> Project Type
// (buttons) -> Image -> Approx Area (list_message) -> Location (ask_question
// + save_to_crm) -> Timeline (list_message) -> Quotation Question (buttons)
// -> Save CRM (notes) -> Update Stage -> Assign Staff -> Confirmation ->
// Follow-up -> End), trimmed to what's needed to prove every node type
// actually works -- Video/Image/Document use synthetic media fixtures, not
// a config this test would need to hand-maintain for every field.
function afitGraph(assignmentMode: "specific" | "auto_team", staffId?: string) {
  return {
    version: 3,
    meta: { publishedAt: null },
    nodes: [
      { id: "trigger", type: "trigger", position: { x: 0, y: 0 }, data: { keywords: [] } },
      { id: "create_lead", type: "create_or_link_lead", position: { x: 0, y: 0 }, data: {} },
      { id: "welcome", type: "send_text", position: { x: 0, y: 0 }, data: { text: "Welcome! Thank you for contacting AFIT." } },
      { id: "project_type", type: "buttons", position: { x: 0, y: 0 }, data: {
        text: "Is your project a new building or existing property?",
        buttons: [
          { id: "new_building", label: "New Building" },
          { id: "existing_property", label: "Existing Property" },
          { id: "not_sure", label: "Not Sure" },
        ],
      } },
      { id: "save_project_type_new", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "project_type", valueSource: "fixed", fixedValue: "New Building" } },
      { id: "save_project_type_existing", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "project_type", valueSource: "fixed", fixedValue: "Existing Property" } },
      { id: "save_project_type_unsure", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "project_type", valueSource: "fixed", fixedValue: "Not Sure" } },
      { id: "area", type: "list_message", position: { x: 0, y: 0 }, data: {
        text: "Approximately how much area needs plastering?",
        listTitle: "Choose a range",
        items: [
          { id: "lt_5000", label: "< 5,000 sq ft" },
          { id: "r_5_20k", label: "5,000 - 20,000 sq ft" },
          { id: "r_20_50k", label: "20,000 - 50,000 sq ft" },
          { id: "gt_50000", label: "> 50,000 sq ft" },
        ],
      } },
      { id: "save_area_1", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "notes", valueSource: "fixed", fixedValue: "Area: < 5,000 sq ft" } },
      { id: "save_area_2", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "notes", valueSource: "fixed", fixedValue: "Area: 5,000 - 20,000 sq ft" } },
      { id: "save_area_3", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "notes", valueSource: "fixed", fixedValue: "Area: 20,000 - 50,000 sq ft" } },
      { id: "save_area_4", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "notes", valueSource: "fixed", fixedValue: "Area: > 50,000 sq ft" } },
      { id: "ask_location", type: "ask_question", position: { x: 0, y: 0 }, data: { text: "Where is the project located?" } },
      { id: "save_location", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "location", valueSource: "customer_reply" } },
      { id: "quotation_q", type: "buttons", position: { x: 0, y: 0 }, data: {
        text: "Would you like our team to contact you for a detailed quotation?",
        buttons: [
          { id: "yes", label: "Yes, please" },
          { id: "not_now", label: "Not now" },
          { id: "more_info", label: "Need more info" },
        ],
      } },
      { id: "save_quote_yes", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "notes", valueSource: "fixed", fixedValue: "Quotation interest: Yes, please" } },
      { id: "save_quote_not_now", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "notes", valueSource: "fixed", fixedValue: "Quotation interest: Not now" } },
      { id: "save_quote_more_info", type: "save_to_crm", position: { x: 0, y: 0 }, data: { fieldKey: "notes", valueSource: "fixed", fixedValue: "Quotation interest: Need more info" } },
      { id: "update_stage", type: "update_stage", position: { x: 0, y: 0 }, data: { stage: "qualified" } },
      { id: "assign_staff", type: "assign_staff", position: { x: 0, y: 0 }, data: { assignmentMode, staffId } },
      { id: "confirmation", type: "send_text", position: { x: 0, y: 0 }, data: { text: "Thank you! Our team will contact you shortly." } },
      { id: "follow_up", type: "create_follow_up", position: { x: 0, y: 0 }, data: { followUpTitle: "Gypsum plastering quotation follow-up", followUpDueHours: 24 } },
      { id: "end", type: "end_flow", position: { x: 0, y: 0 }, data: {} },
      { id: "default_reply", type: "send_text", position: { x: 0, y: 0 }, data: { text: "How can we help you? Please type Gypsum plastering, Rate, or Quotation." } },
      { id: "no_match_end", type: "end_flow", position: { x: 0, y: 0 }, data: {} },
    ],
    edges: [
      { id: "e1", source: "trigger", target: "create_lead", sourceHandle: "matched" },
      { id: "e-nm", source: "trigger", target: "default_reply", sourceHandle: "not_matched" },
      { id: "e-nm2", source: "default_reply", target: "no_match_end", sourceHandle: "next" },
      { id: "e2", source: "create_lead", target: "welcome", sourceHandle: "next" },
      { id: "e3", source: "welcome", target: "project_type", sourceHandle: "next" },
      { id: "e4a", source: "project_type", target: "save_project_type_new", sourceHandle: "new_building" },
      { id: "e4b", source: "project_type", target: "save_project_type_existing", sourceHandle: "existing_property" },
      { id: "e4c", source: "project_type", target: "save_project_type_unsure", sourceHandle: "not_sure" },
      { id: "e5a", source: "save_project_type_new", target: "area", sourceHandle: "next" },
      { id: "e5b", source: "save_project_type_existing", target: "area", sourceHandle: "next" },
      { id: "e5c", source: "save_project_type_unsure", target: "area", sourceHandle: "next" },
      { id: "e6a", source: "area", target: "save_area_1", sourceHandle: "lt_5000" },
      { id: "e6b", source: "area", target: "save_area_2", sourceHandle: "r_5_20k" },
      { id: "e6c", source: "area", target: "save_area_3", sourceHandle: "r_20_50k" },
      { id: "e6d", source: "area", target: "save_area_4", sourceHandle: "gt_50000" },
      { id: "e7a", source: "save_area_1", target: "ask_location", sourceHandle: "next" },
      { id: "e7b", source: "save_area_2", target: "ask_location", sourceHandle: "next" },
      { id: "e7c", source: "save_area_3", target: "ask_location", sourceHandle: "next" },
      { id: "e7d", source: "save_area_4", target: "ask_location", sourceHandle: "next" },
      { id: "e8", source: "ask_location", target: "save_location", sourceHandle: "next" },
      { id: "e9", source: "save_location", target: "quotation_q", sourceHandle: "next" },
      { id: "e10a", source: "quotation_q", target: "save_quote_yes", sourceHandle: "yes" },
      { id: "e10b", source: "quotation_q", target: "save_quote_not_now", sourceHandle: "not_now" },
      { id: "e10c", source: "quotation_q", target: "save_quote_more_info", sourceHandle: "more_info" },
      { id: "e11a", source: "save_quote_yes", target: "update_stage", sourceHandle: "next" },
      { id: "e11b", source: "save_quote_not_now", target: "update_stage", sourceHandle: "next" },
      { id: "e11c", source: "save_quote_more_info", target: "update_stage", sourceHandle: "next" },
      { id: "e12", source: "update_stage", target: "assign_staff", sourceHandle: "next" },
      { id: "e13", source: "assign_staff", target: "confirmation", sourceHandle: "next" },
      { id: "e14", source: "confirmation", target: "follow_up", sourceHandle: "next" },
      { id: "e15", source: "follow_up", target: "end", sourceHandle: "next" },
    ],
  };
}

function params(overrides: Partial<{ messageId: string; conversationId: string; body: string | null; phone: string; customerName: string | null }> = {}) {
  return {
    messageId: "msg-1",
    conversationId: "conv-1",
    body: "Hi, I need gypsum plastering quotation",
    phone: "+919000000001",
    customerName: "Test Caller",
    ...overrides,
  };
}

describe("Step 7: AFIT Gypsum Plastering workflow -- synthetic end-to-end", () => {
  let db: MemoryDb;
  let serviceId: string;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new MemoryDb();
    db.seedStaff("staff-azhar", "staff");
    const service = db.seedService("Gypsum plaster");
    serviceId = service.id as string;
    for (const kw of ["gypsum plastering", "gypsum", "plastering", "plaster", "rate", "quotation", "quote", "gypsum work", "false ceiling", "gypsum ceiling"]) {
      db.seedKeyword(serviceId, kw);
    }
    db.seedAutomation(serviceId, afitGraph("specific", "staff-azhar"));
    db.seedConversation("conv-1");
  });

  // Scenario A -- MATCH: full happy path, every transition.
  it("Scenario A: a matching inbound message walks the full flow to completion", async () => {
    let result = await triggerAutomationForMessage(db.client(), params({ messageId: "m1" }));
    expect(result.status).toBe("matched"); // paused at project_type after create_lead/welcome

    let session = db.automation_sessions[0];
    expect(session.status).toBe("active");
    expect(session.current_node_id).toBe("project_type");
    expect(db.leads).toHaveLength(1);

    result = await triggerAutomationForMessage(db.client(), params({ messageId: "m2", body: "New Building" }));
    session = db.automation_sessions[0];
    expect(session.current_node_id).toBe("area");

    result = await triggerAutomationForMessage(db.client(), params({ messageId: "m3", body: "5,000 - 20,000 sq ft" }));
    session = db.automation_sessions[0];
    // save_area (fixed) and ask_location (ask_question) never pause on their
    // own -- the walk runs straight through both to save_location, which does.
    expect(session.current_node_id).toBe("save_location");

    result = await triggerAutomationForMessage(db.client(), params({ messageId: "m4", body: "Kochi, Kerala" }));
    session = db.automation_sessions[0];
    expect(session.current_node_id).toBe("quotation_q");

    result = await triggerAutomationForMessage(db.client(), params({ messageId: "m5", body: "Yes, please" }));

    expect(result.status).toBe("matched");
    session = db.automation_sessions[0];
    expect(session.status).toBe("completed");

    const lead = db.leads[0];
    expect(lead.status).toBe("qualified");
    expect(lead.assigned_to_id).toBe("staff-azhar");
    expect(lead.location).toBe("Kochi, Kerala");
    expect(lead.project_type).toBe("New Building");
    expect(String(lead.qualification_notes)).toContain("5,000 - 20,000 sq ft");
    expect(String(lead.qualification_notes)).toContain("Quotation interest: Yes, please");

    expect(db.follow_ups).toHaveLength(1);
    expect(db.follow_ups[0].notes).toBe("[Automation] Gypsum plastering quotation follow-up");

    // Confirmation + welcome + the two buttons/list prompts were all sent as text.
    expect(sendTextMessage).toHaveBeenCalled();
    const sentBodies = (sendTextMessage as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[2]);
    expect(sentBodies.some((b) => String(b).includes("Thank you"))).toBe(true);
  });

  // Scenario B -- NO MATCH at the top level never reaches any graph (see
  // report: this is the confirmed architecture gap, not a bug this test
  // hides). What IS tested here, and what Scenario B actually verifies per
  // the executor's own capability: a direct walk from the trigger's
  // not_matched port correctly reaches Default Reply -> End.
  it("Scenario B: a direct not_matched walk reaches Default Reply and ends (proves the branch itself works)", async () => {
    const { startAndAdvance } = await import("./executor");
    const outcome = await startAndAdvance(
      db.client(),
      afitGraph("specific", "staff-azhar"),
      "trigger",
      { conversationId: "conv-1", phone: "+919000000001", customerName: "Test", serviceName: "Gypsum plaster" },
      { sendText: async (_id: string, text: string) => { await sendTextMessage("x", "y", text); }, sendMedia: async () => {}, sendDocument: async () => {} },
      "not_matched"
    );
    expect(outcome.outcome).toBe("completed");
    const sentBodies = (sendTextMessage as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[2]);
    expect(sentBodies.some((b) => String(b).includes("How can we help"))).toBe(true);
  });

  it("a genuinely unmatched top-level message never touches the graph at all (the real architecture gap)", async () => {
    const result = await triggerAutomationForMessage(db.client(), params({ messageId: "m-nomatch", body: "hello" }));
    expect(result.status).toBe("no_match");
    expect(db.automation_sessions).toHaveLength(0);
    expect(sendTextMessage).not.toHaveBeenCalled();
  });

  // Scenario C -- every Project Type option.
  it.each(["New Building", "Existing Property", "Not Sure", "2"])("Scenario C: Project Type option %j is accepted", async (reply) => {
    await triggerAutomationForMessage(db.client(), params({ messageId: "c1" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "c2", body: reply }));
    const session = db.automation_sessions[0];
    expect(session.current_node_id).toBe("area");
  });

  // Scenario D -- every Area option.
  it.each(["< 5,000 sq ft", "5,000 - 20,000 sq ft", "20,000 - 50,000 sq ft", "> 50,000 sq ft", "3"])(
    "Scenario D: Area option %j is accepted",
    async (reply) => {
      await triggerAutomationForMessage(db.client(), params({ messageId: "d1" }));
      await triggerAutomationForMessage(db.client(), params({ messageId: "d2", body: "New Building" }));
      await triggerAutomationForMessage(db.client(), params({ messageId: "d3", body: reply }));
      const session = db.automation_sessions[0];
      expect(session.current_node_id).toBe("save_location");
    }
  );

  // Scenario F -- Quotation Question options (E/Timeline is structurally
  // identical to D/Area in this engine -- both are list_message/buttons
  // nodes handled by the same matchChoice() code path; not re-tested with a
  // separate node here to avoid a redundant fixture).
  it.each(["Yes, please", "Not now", "Need more info"])("Scenario F: Quotation option %j completes the flow", async (reply) => {
    await triggerAutomationForMessage(db.client(), params({ messageId: "f1" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "f2", body: "New Building" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "f3", body: "< 5,000 sq ft" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "f4", body: "Kochi" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "f5", body: reply }));
    const session = db.automation_sessions[0];
    expect(session.status).toBe("completed");
    expect(db.leads[0].status).toBe("qualified");
  });

  // Scenario G -- free-text Location capture.
  it("Scenario G: Location is correctly collected as free text", async () => {
    await triggerAutomationForMessage(db.client(), params({ messageId: "g1" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "g2", body: "New Building" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "g3", body: "< 5,000 sq ft" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "g4", body: "Thrissur, Kerala" }));
    expect(db.leads[0].location).toBe("Thrissur, Kerala");
  });

  // Scenario H -- session resume: interrupt and resume.
  it("Scenario H: an interrupted session resumes at the correct node with collected_data intact", async () => {
    await triggerAutomationForMessage(db.client(), params({ messageId: "h1" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "h2", body: "Existing Property" }));
    let session = db.automation_sessions[0];
    expect(session.current_node_id).toBe("area");
    const collectedAfterH2 = { ...(session.collected_data as Record<string, string>) };

    // Simulate a real interruption: nothing more happens for a while, then a
    // genuinely new inbound message resumes the SAME session.
    await triggerAutomationForMessage(db.client(), params({ messageId: "h3", body: "20,000 - 50,000 sq ft" }));
    session = db.automation_sessions[0];
    expect(session.current_node_id).toBe("save_location");
    // Nothing from before the interruption was lost.
    for (const [k, v] of Object.entries(collectedAfterH2)) {
      expect((session.collected_data as Record<string, string>)[k]).toBe(v);
    }
  });

  // Scenario I -- duplicate concurrent delivery of the SAME message.
  it("Scenario I: two concurrent deliveries of the same new inbound message create no duplicates", async () => {
    db.barriers.automation_sessions = new Barrier(2);

    const [a, b] = await Promise.all([
      triggerAutomationForMessage(db.client(), params({ messageId: "same-msg" })),
      triggerAutomationForMessage(db.client(), params({ messageId: "same-msg" })),
    ]);

    // automation_runs.message_id is unique -- one wins, one is a no-op.
    expect([a.runId, b.runId].filter((id) => id !== null)).toHaveLength(1);
    expect(db.automation_sessions).toHaveLength(1);
    expect(db.leads).toHaveLength(1);
    expect(db.conversations).toHaveLength(1);
  });

  // Scenario J -- forced synthetic action failure.
  it("Scenario J: a failing action marks the run and session failed, with no corrupted partial state", async () => {
    // A send_text with no text configured throws inside the walk -- forces
    // the exact failure path trigger.ts's catch handles.
    const brokenGraph = afitGraph("specific", "staff-azhar");
    (brokenGraph.nodes.find((n) => n.id === "welcome") as { data: Record<string, unknown> }).data = {};
    db.automations[0].actions = brokenGraph;

    const result = await triggerAutomationForMessage(db.client(), params({ messageId: "j1" }));

    expect(result.status).toBe("failed");
    const run = db.automation_runs.find((r) => r.id === result.runId);
    expect(run?.status).toBe("failed");
    expect(String(run?.error_message)).toMatch(/no text configured/);

    const session = db.automation_sessions[0];
    expect(session.status).toBe("failed");
    // The lead WAS created (create_lead ran before the failing welcome node)
    // -- proving failure doesn't roll back already-committed CRM writes,
    // and doesn't corrupt the session into some undefined state either.
    expect(db.leads).toHaveLength(1);
  });

  it("Scenario J: Assign Staff set to Automatic / Team fails the run with the specific, documented blocker", async () => {
    db.automations[0].actions = afitGraph("auto_team");

    await triggerAutomationForMessage(db.client(), params({ messageId: "j2" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "j3", body: "New Building" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "j4", body: "< 5,000 sq ft" }));
    await triggerAutomationForMessage(db.client(), params({ messageId: "j5", body: "Kochi" }));
    const result = await triggerAutomationForMessage(db.client(), params({ messageId: "j6", body: "Yes, please" }));

    expect(result.status).toBe("failed");
    const run = db.automation_runs.find((r) => r.id === result.runId);
    expect(String(run?.error_message)).toMatch(/Automatic \/ Team.*no defined runtime behavior/);
    // The lead must still be unassigned -- no invented strategy silently ran.
    expect(db.leads[0].assigned_to_id ?? null).toBeNull();
  });

  // Scenario K -- invalid graph rejected before execution.
  it("Scenario K: an invalid/unparseable graph is rejected before any node executes", async () => {
    db.automations[0].actions = { version: 3, meta: {}, nodes: [{ id: "a", type: "nonsense_type", position: { x: 0, y: 0 } }], edges: [] };

    const result = await triggerAutomationForMessage(db.client(), params({ messageId: "k1" }));

    expect(result.status).toBe("failed");
    expect(db.leads).toHaveLength(0); // nothing executed
    expect(db.automation_sessions).toHaveLength(0); // no session was even started
  });

  it("Scenario K: a graph with no trigger is rejected before a session is started", async () => {
    const graph = afitGraph("specific", "staff-azhar");
    graph.nodes = graph.nodes.filter((n) => n.type !== "trigger");
    db.automations[0].actions = graph;

    const result = await triggerAutomationForMessage(db.client(), params({ messageId: "k2" }));
    expect(result.status).toBe("failed");
    expect(db.automation_sessions).toHaveLength(0);
  });

  // Scenario L -- persist, "reload" (fresh client/module-level state), resume.
  it("Scenario L: a session persisted by one call resumes correctly via an entirely fresh client instance", async () => {
    await triggerAutomationForMessage(db.client(), params({ messageId: "l1" }));
    // A brand-new client() call models "reload the executor context" --
    // nothing in this codebase holds in-memory state across requests
    // (confirmed by audit: session state lives only in automation_sessions),
    // so a fresh client is a faithful stand-in for a cold Lambda invocation.
    const freshClient = db.client();
    await triggerAutomationForMessage(freshClient, params({ messageId: "l2", body: "New Building" }));
    const session = db.automation_sessions[0];
    expect(session.current_node_id).toBe("area");
  });

  // Media runtime: proven with synthetic fixtures (automation_media's real
  // CHECK constraint only allows image/video -- see the report's media
  // blocker; this fixture needs no such constraint).
  it("send_image and send_video execute against a synthetic cached media asset", async () => {
    const image = db.seedMediaAsset("image");
    const video = db.seedMediaAsset("video");
    const graph = afitGraph("specific", "staff-azhar");
    graph.nodes.push(
      { id: "video_step", type: "send_video", position: { x: 0, y: 0 }, data: { mediaAssetId: video.id as string } } as never,
      { id: "image_step", type: "send_image", position: { x: 0, y: 0 }, data: { mediaAssetId: image.id as string } } as never
    );
    graph.edges.push(
      { id: "ev1", source: "welcome", target: "video_step", sourceHandle: "next" } as never,
      { id: "ev2", source: "video_step", target: "image_step", sourceHandle: "next" } as never,
      { id: "ev3", source: "image_step", target: "project_type", sourceHandle: "next" } as never
    );
    graph.edges = graph.edges.filter((e) => !(e.source === "welcome" && e.target === "project_type"));
    db.automations[0].actions = graph;

    await triggerAutomationForMessage(db.client(), params({ messageId: "media1" }));
    expect(db.messages.some((m) => m.message_type === "video")).toBe(true);
    expect(db.messages.some((m) => m.message_type === "image")).toBe(true);
  });

  it("send_document executes against a synthetic fixture -- proving the code path, not production readiness (see report: no real DB value, no real file)", async () => {
    const doc = db.seedMediaAsset("document");
    const graph = afitGraph("specific", "staff-azhar");
    graph.nodes.push({ id: "doc_step", type: "send_document", position: { x: 0, y: 0 }, data: { mediaAssetId: doc.id as string } } as never);
    graph.edges = graph.edges.filter((e) => !(e.source === "welcome" && e.target === "project_type"));
    graph.edges.push(
      { id: "ed1", source: "welcome", target: "doc_step", sourceHandle: "next" } as never,
      { id: "ed2", source: "doc_step", target: "project_type", sourceHandle: "next" } as never
    );
    db.automations[0].actions = graph;

    await triggerAutomationForMessage(db.client(), params({ messageId: "doc1" }));
    expect(db.messages.some((m) => m.message_type === "document")).toBe(true);
  });

  // Step 8 requirement: a media node reaching production with no file
  // selected must fail the run/session cleanly, like Scenario J above --
  // never send a broken message, never corrupt state.
  it("a send_document block with no media selected fails the run safely, with no message sent", async () => {
    const graph = afitGraph("specific", "staff-azhar");
    graph.nodes.push({ id: "doc_step", type: "send_document", position: { x: 0, y: 0 }, data: {} } as never);
    graph.edges = graph.edges.filter((e) => !(e.source === "welcome" && e.target === "project_type"));
    graph.edges.push(
      { id: "ed1", source: "welcome", target: "doc_step", sourceHandle: "next" } as never,
      { id: "ed2", source: "doc_step", target: "project_type", sourceHandle: "next" } as never
    );
    db.automations[0].actions = graph;

    const result = await triggerAutomationForMessage(db.client(), params({ messageId: "doc-missing" }));

    expect(result.status).toBe("failed");
    const run = db.automation_runs.find((r) => r.id === result.runId);
    expect(String(run?.error_message)).toMatch(/no file selected/);
    expect(db.automation_sessions[0].status).toBe("failed");
    expect(db.messages.some((m) => m.message_type === "document")).toBe(false);
  });
});
