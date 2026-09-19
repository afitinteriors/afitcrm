import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ingestInboundMessage, findLeadByExactPhone, type InboundWhatsAppMessage } from "./ingest";
import { createOrLinkLeadForConversation } from "@/lib/automations/crm-actions";
import { parseWabisMessage } from "./parse-wabis";

// Automation matching/execution is a separate, already-covered concern with
// its own multi-table lookups (services/service_keywords/automations/...).
// Stubbing it out keeps these tests targeted at ingestion (lead matching,
// conversation reuse, message persistence/dedup) rather than pulling in
// unrelated infrastructure.
vi.mock("@/lib/automations/trigger", () => ({
  triggerAutomationForMessage: vi.fn().mockResolvedValue({ runId: null, status: "no_match" }),
}));

// createOrLinkLeadForConversation's own business rules (exact-phone
// matching, fill-if-empty, field values, conversation linking) are unit
// tested directly against a fake Supabase in lib/automations/crm-actions.test.ts.
// Here it's stubbed out so these tests stay targeted at ingest.ts's own
// concern: whether/when it gets called (the gating), and that a failure in
// it can never break message/conversation persistence.
vi.mock("@/lib/automations/crm-actions", () => ({
  createOrLinkLeadForConversation: vi.fn().mockResolvedValue({ leadId: "lead-mock", created: true }),
}));

type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

// A minimal stand-in for postgrest-js's chainable, thenable query builder —
// every chain method returns the same object, and the object itself is
// thenable so both `await builder.eq(...)` (update-terminal calls) and
// `await builder.maybeSingle()` / `.single()` / `.limit()` resolve to the
// configured canned result.
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.limit = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

// Per-table queue of canned results, consumed in call order. Tests set up
// the exact sequence of calls ingestInboundMessage/findOrCreateConversation
// are known (by code inspection) to make for a given scenario.
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

const BASE_MESSAGE: InboundWhatsAppMessage = {
  waMessageId: "wamid.TEST-MSG-1",
  phoneNumberId: "wabis:206059",
  fromPhone: "+919000000000",
  customerName: "Test Customer",
  messageType: "text",
  body: "Hello",
  mediaId: null,
  referral: null,
  raw: { chat_id: "+919000000000" },
};

describe("findLeadByExactPhone", () => {
  // These use an already-canonical phone (see lib/phone.ts) so the lookup
  // resolves on its first (canonical-form) query, keeping this describe
  // block's scripted results one-per-test as before. The canonicalization
  // and legacy-fallback behavior itself is covered separately below.
  it("matches an existing lead by exact phone", async () => {
    const { stub } = createFakeSupabase({ leads: [{ data: [{ id: "lead-1" }], error: null }] });
    await expect(findLeadByExactPhone(stub, "+919000000000")).resolves.toBe("lead-1");
  });

  it("returns null when no lead matches", async () => {
    const { stub } = createFakeSupabase({ leads: [{ data: [], error: null }] });
    await expect(findLeadByExactPhone(stub, "+919000000000")).resolves.toBeNull();
  });

  it("excludes retired/merged leads from the phone lookup (merged_into_id filter)", async () => {
    const { stub, from } = createFakeSupabase({ leads: [{ data: [{ id: "lead-1" }], error: null }] });
    await findLeadByExactPhone(stub, "+919000000000");
    const lookupBuilder = from.mock.results[0].value as { is: ReturnType<typeof vi.fn> };
    expect(lookupBuilder.is).toHaveBeenCalledWith("merged_into_id", null);
  });

  it("returns null (fails closed) on an ambiguous match", async () => {
    const { stub } = createFakeSupabase({
      leads: [{ data: [{ id: "lead-1" }, { id: "lead-2" }], error: null }],
    });
    await expect(findLeadByExactPhone(stub, "+919000000000")).resolves.toBeNull();
  });

  describe("phone canonicalization (lib/phone.ts)", () => {
    it("+91, 91, and bare Indian national forms all resolve to the same lead", async () => {
      for (const phone of ["+919000000000", "919000000000", "9000000000", "91-90000-00000"]) {
        const { stub, from } = createFakeSupabase({ leads: [{ data: [{ id: "lead-1" }], error: null }] });
        await expect(findLeadByExactPhone(stub, phone)).resolves.toBe("lead-1");
        const lookupBuilder = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
        expect(lookupBuilder.eq).toHaveBeenCalledWith("phone", "+919000000000");
      }
    });

    it("preserves an international number's real country code rather than treating it as Indian", async () => {
      const { stub, from } = createFakeSupabase({ leads: [{ data: [{ id: "lead-us" }], error: null }] });
      await expect(findLeadByExactPhone(stub, "+1 415 555 2671")).resolves.toBe("lead-us");
      const lookupBuilder = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
      expect(lookupBuilder.eq).toHaveBeenCalledWith("phone", "+14155552671");
    });

    it("falls back to an exact match on the raw input when the canonical form finds nothing -- legacy pre-canonicalization leads", async () => {
      const { stub, from } = createFakeSupabase({
        leads: [
          { data: [], error: null }, // canonical-form lookup: no match
          { data: [{ id: "lead-legacy" }], error: null }, // raw-form fallback lookup: 1 match
        ],
      });

      await expect(findLeadByExactPhone(stub, "919000000000")).resolves.toBe("lead-legacy");

      const canonicalLookup = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
      expect(canonicalLookup.eq).toHaveBeenCalledWith("phone", "+919000000000");
      const rawFallbackLookup = from.mock.results[1].value as { eq: ReturnType<typeof vi.fn> };
      expect(rawFallbackLookup.eq).toHaveBeenCalledWith("phone", "919000000000");
    });

    it("does not attempt a raw-form fallback when the input is already canonical", async () => {
      const { stub, from } = createFakeSupabase({ leads: [{ data: [], error: null }] });
      await expect(findLeadByExactPhone(stub, "+919000000000")).resolves.toBeNull();
      expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
    });

    it("falls back to matching the raw string as-is when the phone is unparseable, rather than refusing to look up", async () => {
      const { stub, from } = createFakeSupabase({ leads: [{ data: [{ id: "lead-weird" }], error: null }] });
      await expect(findLeadByExactPhone(stub, "not-a-phone-number")).resolves.toBe("lead-weird");
      const lookupBuilder = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
      expect(lookupBuilder.eq).toHaveBeenCalledWith("phone", "not-a-phone-number");
    });
  });
});

describe("ingestInboundMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists a message for a new conversation with an existing lead matched by phone (chat_id)", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: null, error: null }, // no existing conversation
        { data: { id: "conv-1" }, error: null }, // created
        { error: null }, // updated_at touch
      ],
      leads: [{ data: [{ id: "lead-1" }], error: null }],
      messages: [{ data: { id: "msg-1" }, error: null }],
    });

    await ingestInboundMessage(stub, BASE_MESSAGE);

    // Global from() call order: 0 conversations.select (miss), 1 leads.select
    // (findLeadByExactPhone), 2 conversations.insert (create), 3 messages.insert,
    // 4 conversations.update (touch).
    const conversationsInsertBuilder = from.mock.results[2].value;
    expect(conversationsInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ lead_id: "lead-1", wa_id: "+919000000000", phone_number_id: "wabis:206059" })
    );

    const messagesInsertBuilder = from.mock.results[3].value;
    expect(messagesInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conv-1",
        wa_message_id: "wamid.TEST-MSG-1",
        direction: "inbound",
        message_type: "text",
        body: "Hello",
        media_id: null,
      })
    );
  });

  it("creates a conversation with no lead_id when no lead matches", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: null, error: null },
        { data: { id: "conv-2" }, error: null },
        { error: null },
      ],
      leads: [{ data: [], error: null }],
      messages: [{ data: { id: "msg-2" }, error: null }],
    });

    await ingestInboundMessage(stub, BASE_MESSAGE);

    const conversationsInsertBuilder = from.mock.results[2].value;
    expect(conversationsInsertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ lead_id: null }));
  });

  it("reuses an existing conversation instead of creating a new one", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: { id: "conv-existing" }, error: null }, // found -- reused
        { error: null }, // updated_at touch
      ],
      messages: [{ data: { id: "msg-3" }, error: null }],
    });

    await ingestInboundMessage(stub, BASE_MESSAGE);

    // Only 2 calls to conversations (select + update) -- no insert/create call.
    expect(from.mock.calls.filter(([table]) => table === "conversations")).toHaveLength(2);
    const messagesInsertBuilder = from.mock.results[1].value;
    expect(messagesInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ conversation_id: "conv-existing" })
    );
  });

  it("treats a duplicate wa_message_id as a no-op, not an error", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { stub, from } = createFakeSupabase({
      conversations: [{ data: { id: "conv-4" }, error: null }],
      messages: [{ data: null, error: { code: "23505", message: "duplicate key" } }],
    });

    await ingestInboundMessage(stub, BASE_MESSAGE);

    // No conversations.update (touch) call after a duplicate -- ingestion
    // stops right after the failed insert, exactly as the existing Meta
    // path already behaves.
    expect(from.mock.calls.filter(([table]) => table === "conversations")).toHaveLength(1);
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Failed to persist"),
      expect.anything()
    );
    consoleErrorSpy.mockRestore();
  });

  it("a WABIS delivery with empty postbackid, processed twice, results in only one message row", async () => {
    // Real scenario: WABIS's own confirmed duplicate-delivery/retry behavior
    // sends the identical payload twice. parseWabisMessage() derives the
    // same deterministic fallback waMessageId both times (see
    // parse-wabis.test.ts), so the second insert hits the real
    // messages.wa_message_id UNIQUE constraint exactly like a genuine
    // duplicate postbackid would -- proven here via the same 23505 handling
    // already covered above, but with an actual WABIS-shaped payload/key.
    const wabisPayload = {
      first_name: "Test",
      chat_id: "919000000000",
      postbackid: "", // the real-world production shape that triggered this fix
      user_input_data: [] as unknown[],
      user_message: "Hello",
      whatsapp_bot_username: "+91 7356877322",
    };
    const parsed = parseWabisMessage(wabisPayload);
    expect(parsed).not.toBeNull();
    expect(parsed?.waMessageId).toMatch(/^wabis-fallback:[0-9a-f]{64}$/);

    // First delivery: conversation created, message inserted successfully.
    const first = createFakeSupabase({
      conversations: [
        { data: null, error: null },
        { data: { id: "conv-wabis-dup" }, error: null },
        { error: null },
      ],
      leads: [{ data: [], error: null }],
      messages: [{ data: { id: "msg-first" }, error: null }],
    });
    await ingestInboundMessage(first.stub, parsed!);
    expect(first.from.mock.calls.filter(([table]) => table === "messages")).toHaveLength(1);

    // Second delivery (the retry): same conversation found, same
    // waMessageId -- the DB rejects the insert with 23505, ingest treats it
    // as an already-recorded no-op, not a second row.
    const second = createFakeSupabase({
      conversations: [{ data: { id: "conv-wabis-dup" }, error: null }],
      messages: [{ data: null, error: { code: "23505", message: "duplicate key" } }],
    });
    await ingestInboundMessage(second.stub, parsed!);
    expect(second.from.mock.calls.filter(([table]) => table === "conversations")).toHaveLength(1); // no update-touch after the duplicate
  });

  it("never invents/applies attribution for a WABIS-shaped message (referral: null)", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: null, error: null },
        { data: { id: "conv-5" }, error: null },
        { error: null },
      ],
      leads: [{ data: [{ id: "lead-5" }], error: null }],
      messages: [{ data: { id: "msg-5" }, error: null }],
    });

    await ingestInboundMessage(stub, { ...BASE_MESSAGE, referral: null });

    // Exactly one call to "leads" (the phone lookup) -- no second call to
    // apply a referral-derived ad_id, since referral is null.
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
  });

  it("fills service_required from serviceHint on an existing lead with NULL service_required (Gypsum WABIS)", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: { id: "conv-6", lead_id: "lead-6" }, error: null }, // existing conversation, already linked to a lead
        { error: null }, // updated_at touch
      ],
      leads: [{ data: null, error: null }], // fill-if-empty update succeeds
      messages: [{ data: { id: "msg-6" }, error: null }],
    });

    await ingestInboundMessage(stub, { ...BASE_MESSAGE, serviceHint: "Gypsum Plaster" });

    // from() call order here: 0 conversations.select (hit), 1 leads.update
    // (service hint fill), 2 messages.insert, 3 conversations.update (touch).
    const leadsUpdateBuilder = from.mock.results[1].value;
    expect(leadsUpdateBuilder.update).toHaveBeenCalledWith({ service_required: "Gypsum Plaster" });
    expect(leadsUpdateBuilder.eq).toHaveBeenCalledWith("id", "lead-6");
    expect(leadsUpdateBuilder.is).toHaveBeenCalledWith("service_required", null);
  });

  it("does not overwrite an existing (different) service_required", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: { id: "conv-7", lead_id: "lead-7" }, error: null },
        { error: null },
      ],
      // Real Postgres outcome for a lead whose service_required is already
      // non-null: the .is("service_required", null) filter matches 0 rows,
      // so the update succeeds with no error and no matched row -- exactly
      // what this canned result simulates. Same never-clobber convention as
      // applyReferralToLead's .is("ad_id", null).
      leads: [{ data: null, error: null }],
      messages: [{ data: { id: "msg-7" }, error: null }],
    });

    await ingestInboundMessage(stub, { ...BASE_MESSAGE, serviceHint: "Gypsum Plaster" });

    const leadsUpdateBuilder = from.mock.results[1].value;
    // The guard clause is what actually prevents the overwrite at the DB
    // layer -- this asserts the write is always sent with that guard, never
    // as an unconditional overwrite.
    expect(leadsUpdateBuilder.is).toHaveBeenCalledWith("service_required", null);
    // Ingestion proceeds normally regardless -- the guarded write is a
    // best-effort side effect, not a precondition for persisting the message.
    const messagesInsertBuilder = from.mock.results[2].value;
    expect(messagesInsertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ conversation_id: "conv-7" }));
  });

  it("never touches service_required for a Meta-sourced message (no serviceHint)", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: { id: "conv-8", lead_id: "lead-8" }, error: null },
        { error: null },
      ],
      messages: [{ data: { id: "msg-8" }, error: null }],
    });

    await ingestInboundMessage(stub, BASE_MESSAGE); // BASE_MESSAGE has no serviceHint, like every Meta-parsed message

    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(0);
  });

  it("creates and links a lead for a new service-hinted contact with no existing lead (Gypsum WABIS)", async () => {
    const { stub } = createFakeSupabase({
      conversations: [
        { data: null, error: null }, // no existing conversation
        { data: { id: "conv-9" }, error: null }, // created with lead_id null (no phone match yet)
        { error: null }, // updated_at touch
      ],
      leads: [{ data: [], error: null }], // findLeadByExactPhone: 0 matches
      messages: [{ data: { id: "msg-9" }, error: null }],
    });

    await ingestInboundMessage(stub, { ...BASE_MESSAGE, serviceHint: "Gypsum Plaster" });

    expect(createOrLinkLeadForConversation).toHaveBeenCalledWith(
      stub,
      expect.objectContaining({
        conversationId: "conv-9",
        phone: "+919000000000",
        customerName: "Test Customer",
        serviceName: "Gypsum Plaster",
      })
    );
  });

  it("does not attempt lead creation when an existing lead already matches by phone", async () => {
    const { stub } = createFakeSupabase({
      conversations: [
        { data: { id: "conv-10", lead_id: "lead-10" }, error: null }, // already linked
        { error: null },
      ],
      leads: [{ data: null, error: null }], // service_required fill-if-empty (existing-lead path)
      messages: [{ data: { id: "msg-10" }, error: null }],
    });

    await ingestInboundMessage(stub, { ...BASE_MESSAGE, serviceHint: "Gypsum Plaster" });

    expect(createOrLinkLeadForConversation).not.toHaveBeenCalled();
  });

  it("never attempts automatic lead creation without a serviceHint, even with no existing lead match (Meta ingestion unaffected)", async () => {
    const { stub } = createFakeSupabase({
      conversations: [
        { data: null, error: null },
        { data: { id: "conv-11" }, error: null },
        { error: null },
      ],
      leads: [{ data: [], error: null }], // no phone match
      messages: [{ data: { id: "msg-11" }, error: null }],
    });

    await ingestInboundMessage(stub, BASE_MESSAGE); // no serviceHint

    expect(createOrLinkLeadForConversation).not.toHaveBeenCalled();
  });

  it("does not break message/conversation persistence when lead creation fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createOrLinkLeadForConversation).mockRejectedValueOnce(new Error("boom"));

    const { stub, from } = createFakeSupabase({
      conversations: [
        { data: null, error: null },
        { data: { id: "conv-12" }, error: null },
        { error: null }, // updated_at touch -- still reached despite the failure above
      ],
      leads: [{ data: [], error: null }],
      messages: [{ data: { id: "msg-12" }, error: null }],
    });

    await ingestInboundMessage(stub, { ...BASE_MESSAGE, serviceHint: "Gypsum Plaster" });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to create/link a lead"),
      expect.anything()
    );
    // Message still persisted and the conversation still touched -- the
    // lead-creation failure never reached the webhook's own response path.
    expect(from.mock.calls.filter(([table]) => table === "messages")).toHaveLength(1);
    expect(from.mock.calls.filter(([table]) => table === "conversations")).toHaveLength(3);
    consoleErrorSpy.mockRestore();
  });
});
