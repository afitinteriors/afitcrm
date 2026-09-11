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
  phone: "919000000000",
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
      phone: "919000000000",
      customer_name: "Test Customer",
      service_required: "Gypsum Plaster",
      source: "whatsapp",
    });

    const linkBuilder = from.mock.results[2].value;
    expect(linkBuilder.update).toHaveBeenCalledWith({ lead_id: "lead-new" });
    expect(linkBuilder.eq).toHaveBeenCalledWith("id", "conv-1");
    expect(linkBuilder.is).toHaveBeenCalledWith("lead_id", null);
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

  it("fails closed (throws) on an ambiguous phone match (2+ matches), creating nothing", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: [{ id: "lead-a" }, { id: "lead-b" }], error: null }],
    });

    await expect(createOrLinkLeadForConversation(stub, BASE_CONTEXT)).rejects.toThrow(/Ambiguous phone match/);

    // Only the phone lookup happened -- no insert, no update, no link.
    expect(from.mock.calls.filter(([table]) => table === "leads")).toHaveLength(1);
    expect(from.mock.calls.filter(([table]) => table === "conversations")).toHaveLength(0);
  });
});
