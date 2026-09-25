import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createOrLinkLeadForConversation, type CreateOrLinkLeadContext } from "./crm-actions";

type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

// Same minimal chainable/thenable query-builder stand-in as
// lib/whatsapp/ingest.test.ts -- no shared test-utils module exists yet, so
// this stays colocated per that file's own convention.
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.limit = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
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

const BASE_CONTEXT: CreateOrLinkLeadContext = {
  conversationId: "conv-1",
  phone: "+919000000000",
  customerName: "Test Customer",
  serviceName: "Gypsum Plaster",
};

describe("createOrLinkLeadForConversation", () => {
  it("creates a new lead when no phone match exists (0 matches)", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // phone lookup: no match
        { data: { id: "lead-new" }, error: null }, // insert
      ],
      conversations: [{ error: null }], // link
    });

    const result = await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

    expect(result).toEqual({ leadId: "lead-new", created: true });

    // Only phone/customer_name/service_required/source are set -- no status
    // (left to the DB default) and no other invented field.
    const insertBuilder = from.mock.results[1].value;
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      phone: "+919000000000",
      customer_name: "Test Customer",
      service_required: "Gypsum Plaster",
      source: "whatsapp",
    });

    const linkBuilder = from.mock.results[2].value;
    expect(linkBuilder.update).toHaveBeenCalledWith({ lead_id: "lead-new" });
    expect(linkBuilder.eq).toHaveBeenCalledWith("id", "conv-1");
    expect(linkBuilder.is).toHaveBeenCalledWith("lead_id", null);
  });

  describe("losing a concurrent-create race (database partial unique index, SQLSTATE 23505)", () => {
    const UNIQUE_VIOLATION = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "leads_active_phone_unique_idx"',
    };

    it("reuses the lead the concurrent request created instead of failing, and creates nothing extra", async () => {
      const { stub, from } = createFakeSupabase({
        leads: [
          { data: [], error: null }, // lookup: nothing yet
          { data: null, error: UNIQUE_VIOLATION }, // our insert lost the race
          { data: [{ id: "lead-winner" }], error: null }, // re-lookup finds the winner
          { data: null, error: null }, // fill-if-empty service_required (existing lead path)
        ],
        conversations: [{ error: null }], // link
      });

      const result = await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

      expect(result).toEqual({ leadId: "lead-winner", created: false });

      // Exactly one insert attempt was made (the losing one) -- never a retry-insert.
      const leadBuilders = from.mock.results
        .map((r, i) => ({ table: from.mock.calls[i][0], builder: r.value as { insert: ReturnType<typeof vi.fn> } }))
        .filter((x) => x.table === "leads");
      expect(leadBuilders.filter((x) => x.builder.insert.mock.calls.length > 0)).toHaveLength(1);

      // The winner's data is never overwritten: only a fill-if-empty write.
      const fillBuilder = from.mock.results[3].value as {
        update: ReturnType<typeof vi.fn>;
        is: ReturnType<typeof vi.fn>;
      };
      expect(fillBuilder.update).toHaveBeenCalledWith({ service_required: "Gypsum Plaster" });
      expect(fillBuilder.is).toHaveBeenCalledWith("service_required", null);

      const linkBuilder = from.mock.results[4].value as { update: ReturnType<typeof vi.fn> };
      expect(linkBuilder.update).toHaveBeenCalledWith({ lead_id: "lead-winner" });
    });

    it("still fails (does not silently succeed) if the conflict cannot be resolved to exactly one active lead", async () => {
      const { stub } = createFakeSupabase({
        leads: [
          { data: [], error: null },
          { data: null, error: UNIQUE_VIOLATION },
          { data: [], error: null }, // re-lookup finds nothing (e.g. the winner was retired in between)
        ],
      });

      await expect(createOrLinkLeadForConversation(stub, BASE_CONTEXT)).rejects.toThrow(/Failed to create lead/);
    });

    it("does not treat a non-unique-violation insert error as a lost race", async () => {
      const { stub } = createFakeSupabase({
        leads: [
          { data: [], error: null },
          { data: null, error: { code: "42501", message: "permission denied" } },
        ],
      });

      await expect(createOrLinkLeadForConversation(stub, BASE_CONTEXT)).rejects.toThrow(/permission denied/);
    });
  });

  it("creates a lead with a null customer_name when none is present -- never invents a name", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null },
        { data: { id: "lead-noname" }, error: null },
      ],
      conversations: [{ error: null }],
    });

    await createOrLinkLeadForConversation(stub, { ...BASE_CONTEXT, customerName: null });

    const insertBuilder = from.mock.results[1].value;
    expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ customer_name: null }));
  });

  it("does not set status explicitly on creation, leaving the DB default ('new') to apply", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null },
        { data: { id: "lead-x" }, error: null },
      ],
      conversations: [{ error: null }],
    });

    await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

    const insertBuilder = from.mock.results[1].value as { insert: ReturnType<typeof vi.fn> };
    const insertedFields = insertBuilder.insert.mock.calls[0][0];
    expect(insertedFields).not.toHaveProperty("status");
  });

  it("fills service_required and links the conversation for an existing single-match lead (1 match)", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [{ id: "lead-existing" }], error: null }, // phone lookup: 1 match
        { data: null, error: null }, // service_required fill-if-empty update
      ],
      conversations: [{ error: null }], // link
    });

    const result = await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

    expect(result).toEqual({ leadId: "lead-existing", created: false });

    const updateBuilder = from.mock.results[1].value;
    expect(updateBuilder.update).toHaveBeenCalledWith({ service_required: "Gypsum Plaster" });
    expect(updateBuilder.eq).toHaveBeenCalledWith("id", "lead-existing");
    expect(updateBuilder.is).toHaveBeenCalledWith("service_required", null);

    const linkBuilder = from.mock.results[2].value;
    expect(linkBuilder.update).toHaveBeenCalledWith({ lead_id: "lead-existing" });
    expect(linkBuilder.is).toHaveBeenCalledWith("lead_id", null);
  });

  it("does not create a second lead for an existing match -- no duplicate insert", async () => {
    const { from, stub } = createFakeSupabase({
      leads: [
        { data: [{ id: "lead-existing" }], error: null },
        { data: null, error: null },
      ],
      conversations: [{ error: null }],
    });

    await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

    const updateBuilder = from.mock.results[1].value as { insert: ReturnType<typeof vi.fn> };
    expect(updateBuilder.insert).not.toHaveBeenCalled();
  });

  it("excludes retired/merged leads from the phone lookup (merged_into_id filter)", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [{ id: "lead-existing" }], error: null },
        { data: null, error: null },
      ],
      conversations: [{ error: null }],
    });

    await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

    const lookupBuilder = from.mock.results[0].value as { is: ReturnType<typeof vi.fn> };
    expect(lookupBuilder.is).toHaveBeenCalledWith("merged_into_id", null);
  });

  it("creates a new lead rather than reviving one when the only phone match is a merged/retired lead", async () => {
    // The fake builder doesn't apply real Postgres filtering -- this
    // simulates the DB-side effect of the merged_into_id filter above (a
    // merged lead's row is excluded, so the query returns 0 matches even
    // though a lead with this phone exists).
    const { stub } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // merged lead filtered out -> no active match
        { data: { id: "lead-new" }, error: null }, // insert
      ],
      conversations: [{ error: null }],
    });

    const result = await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

    expect(result).toEqual({ leadId: "lead-new", created: true });
  });

  it("fails closed (throws) on an ambiguous phone match (2+ matches), creating nothing", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: [{ id: "lead-a" }, { id: "lead-b" }], error: null }],
    });

    await expect(createOrLinkLeadForConversation(stub, BASE_CONTEXT)).rejects.toThrow(/Ambiguous phone match/);

    // Only the phone lookup happened -- no insert, no update, no link.
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
    expect(from.mock.calls.filter(([table]) => table === "conversations")).toHaveLength(0);
  });

  describe("phone canonicalization (lib/phone.ts)", () => {
    it("canonicalizes a raw WABIS-shaped phone (no +) to E.164 for both the lookup and the stored value", async () => {
      const { stub, from } = createFakeSupabase({
        leads: [
          { data: [], error: null }, // canonical-form lookup: no match
          { data: [], error: null }, // raw-form fallback lookup (raw differs from canonical): no match
          { data: { id: "lead-new" }, error: null }, // insert
        ],
        conversations: [{ error: null }],
      });

      await createOrLinkLeadForConversation(stub, { ...BASE_CONTEXT, phone: "919000000000" });

      const lookupBuilder = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
      expect(lookupBuilder.eq).toHaveBeenCalledWith("phone", "+919000000000");

      const insertBuilder = from.mock.results[2].value as { insert: ReturnType<typeof vi.fn> };
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ phone: "+919000000000" })
      );
    });

    it("+91, 91, and bare Indian national forms all look up the same canonical phone", async () => {
      const variants = ["+919000000000", "919000000000", "9000000000", "91-90000-00000"];

      for (const phone of variants) {
        const { stub, from } = createFakeSupabase({
          leads: [{ data: [{ id: "lead-existing" }], error: null }, { data: null, error: null }],
          conversations: [{ error: null }],
        });

        await createOrLinkLeadForConversation(stub, { ...BASE_CONTEXT, phone });

        const lookupBuilder = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
        expect(lookupBuilder.eq).toHaveBeenCalledWith("phone", "+919000000000");
      }
    });

    it("preserves an international number's real country code rather than treating it as Indian", async () => {
      const { stub, from } = createFakeSupabase({
        leads: [
          { data: [], error: null }, // canonical-form lookup: no match
          { data: [], error: null }, // raw-form fallback lookup ("+1 415 555 2671" differs from canonical): no match
          { data: { id: "lead-us" }, error: null }, // insert
        ],
        conversations: [{ error: null }],
      });

      await createOrLinkLeadForConversation(stub, { ...BASE_CONTEXT, phone: "+1 415 555 2671" });

      const lookupBuilder = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
      expect(lookupBuilder.eq).toHaveBeenCalledWith("phone", "+14155552671");

      const insertBuilder = from.mock.results[2].value as { insert: ReturnType<typeof vi.fn> };
      expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ phone: "+14155552671" }));
    });

    it("rejects an unparseable phone number without touching the database at all", async () => {
      const { stub, from } = createFakeSupabase({});

      await expect(
        createOrLinkLeadForConversation(stub, { ...BASE_CONTEXT, phone: "not-a-phone-number" })
      ).rejects.toThrow(/could not be parsed/);

      expect(from).not.toHaveBeenCalled();
    });

    it("falls back to an exact match on the raw input when the canonical form finds nothing -- legacy pre-canonicalization leads", async () => {
      // Simulates a lead created before canonicalization was introduced,
      // still stored under its original raw (non-canonical) phone value.
      const { stub, from } = createFakeSupabase({
        leads: [
          { data: [], error: null }, // canonical-form lookup: no match
          { data: [{ id: "lead-legacy" }], error: null }, // raw-form fallback lookup: 1 match
          { data: null, error: null }, // service_required fill-if-empty update
        ],
        conversations: [{ error: null }],
      });

      const result = await createOrLinkLeadForConversation(stub, { ...BASE_CONTEXT, phone: "919000000000" });

      expect(result).toEqual({ leadId: "lead-legacy", created: false });

      const canonicalLookup = from.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
      expect(canonicalLookup.eq).toHaveBeenCalledWith("phone", "+919000000000");
      const rawFallbackLookup = from.mock.results[1].value as { eq: ReturnType<typeof vi.fn> };
      expect(rawFallbackLookup.eq).toHaveBeenCalledWith("phone", "919000000000");

      // No insert -- the legacy lead was found and reused, not duplicated.
      expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(3);
    });

    it("does not attempt the raw-form fallback lookup when the input is already canonical", async () => {
      const { stub, from } = createFakeSupabase({
        leads: [{ data: [], error: null }, { data: { id: "lead-new" }, error: null }],
        conversations: [{ error: null }],
      });

      await createOrLinkLeadForConversation(stub, { ...BASE_CONTEXT, phone: "+919000000000" });

      // Exactly one lookup (canonical) plus the insert -- no redundant
      // second lookup when raw input already equals its canonical form.
      expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(2);
    });
  });
});

describe("createOrLinkLeadForConversation -- defaultAssigneeId (WABIS new-lead auto-assignment)", () => {
  const AZHAR = "243a2241-848e-4209-8712-8636de4835dd";
  const WITH_ASSIGNEE: CreateOrLinkLeadContext = { ...BASE_CONTEXT, defaultAssigneeId: AZHAR };

  type Spy = ReturnType<typeof vi.fn>;
  type Builder = { insert: Spy; update: Spy; eq: Spy; is: Spy; select: Spy };
  function buildersFor(from: Spy, table: string): Builder[] {
    return from.mock.results.filter((_, i) => from.mock.calls[i][0] === table).map((r) => r.value as Builder);
  }
  function writesOf(from: Spy): unknown[] {
    return buildersFor(from, "leads").flatMap((b) => [...b.insert.mock.calls, ...b.update.mock.calls].map((c) => c[0]));
  }

  it("a genuinely NEW lead is inserted with the validated staff assignee", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // phone lookup: no match
        { data: { id: "lead-new" }, error: null }, // insert
      ],
      profiles: [{ data: [{ id: AZHAR }], error: null }], // validation: staff profile exists
      conversations: [{ error: null }],
    });

    const result = await createOrLinkLeadForConversation(stub, WITH_ASSIGNEE);

    expect(result).toEqual({ leadId: "lead-new", created: true });
    const [profileLookup] = buildersFor(from, "profiles");
    expect(profileLookup.eq).toHaveBeenCalledWith("id", AZHAR);
    expect(profileLookup.eq).toHaveBeenCalledWith("role", "staff");
    expect(buildersFor(from, "leads")[1].insert).toHaveBeenCalledWith({
      phone: "+919000000000",
      customer_name: "Test Customer",
      service_required: "Gypsum Plaster",
      source: "whatsapp",
      assigned_to_id: AZHAR,
    });
  });

  it("an EXISTING lead is never assigned -- no profile lookup, and the only lead write is the service fill-if-empty", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [{ id: "lead-existing" }], error: null }, // 1 match (owned by anyone, or unassigned)
        { data: null, error: null }, // service_required fill-if-empty
      ],
      conversations: [{ error: null }],
    });

    const result = await createOrLinkLeadForConversation(stub, WITH_ASSIGNEE);

    expect(result).toEqual({ leadId: "lead-existing", created: false });
    expect(buildersFor(from, "profiles")).toHaveLength(0);
    expect(writesOf(from)).toEqual([{ service_required: "Gypsum Plaster" }]);
  });

  it("a concurrent-race LOSER reuses the winner and never writes an assignee onto it", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null }, // lookup: nothing yet
        { data: null, error: { code: "23505", message: "leads_active_phone_unique_idx" } }, // lost the race
        { data: [{ id: "lead-winner" }], error: null }, // re-lookup
        { data: null, error: null }, // service_required fill-if-empty
      ],
      profiles: [{ data: [{ id: AZHAR }], error: null }],
      conversations: [{ error: null }],
    });

    const result = await createOrLinkLeadForConversation(stub, WITH_ASSIGNEE);

    expect(result).toEqual({ leadId: "lead-winner", created: false });
    // The only assignee ever sent is on the rejected insert; nothing after it
    // (the fill-if-empty update on the winner) carries assigned_to_id.
    const writes = writesOf(from) as Record<string, unknown>[];
    expect(writes.filter((w) => "assigned_to_id" in w)).toHaveLength(1);
    expect(writes[writes.length - 1]).toEqual({ service_required: "Gypsum Plaster" });
  });

  it("without defaultAssigneeId (automation executor / every non-WABIS caller) the insert is unchanged and no profile lookup happens", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [
        { data: [], error: null },
        { data: { id: "lead-new" }, error: null },
      ],
      conversations: [{ error: null }],
    });

    await createOrLinkLeadForConversation(stub, BASE_CONTEXT);

    expect(buildersFor(from, "profiles")).toHaveLength(0);
    const inserted = buildersFor(from, "leads")[1].insert.mock.calls[0][0];
    expect(inserted).not.toHaveProperty("assigned_to_id");
  });

  describe("failure safety: an assignee that cannot be validated never costs the lead", () => {
    const cases: Array<[string, QueryResult | "throw"]> = [
      ["profile not found (or not staff)", { data: [], error: null }],
      ["profile lookup returns an error", { data: null, error: { message: "network" } }],
      ["profile lookup throws", "throw"],
    ];

    it.each(cases)("%s -> lead still created, unassigned", async (_label, profileResult) => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { stub, from } = createFakeSupabase({
        leads: [
          { data: [], error: null },
          { data: { id: "lead-new" }, error: null },
        ],
        profiles: profileResult === "throw" ? [] : [profileResult],
        conversations: [{ error: null }],
      });
      if (profileResult === "throw") {
        const original = from.getMockImplementation()!;
        from.mockImplementation((table: string) => {
          if (table === "profiles") throw new Error("boom");
          return original(table);
        });
      }

      const result = await createOrLinkLeadForConversation(stub, WITH_ASSIGNEE);

      expect(result).toEqual({ leadId: "lead-new", created: true });
      const inserted = buildersFor(from, "leads")[1].insert.mock.calls[0][0];
      expect(inserted).not.toHaveProperty("assigned_to_id");
      expect(inserted).toMatchObject({ service_required: "Gypsum Plaster", source: "whatsapp" });
      // The log carries no identifier (no UUID, no phone).
      expect(errorSpy.mock.calls.flat().join(" ")).not.toMatch(/243a2241|\+91/);
      errorSpy.mockRestore();
    });
  });
});
