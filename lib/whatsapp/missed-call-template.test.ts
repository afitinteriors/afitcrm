import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const sendTemplateMessageMock = vi.fn();
vi.mock("@/lib/whatsapp/send-message", () => ({
  sendTemplateMessage: (...args: unknown[]) => sendTemplateMessageMock(...args),
  SendMessageError: class SendMessageError extends Error {
    publicMessage: string;
    constructor(_code: string, message: string, publicMessage?: string) {
      super(message);
      this.publicMessage = publicMessage ?? message;
    }
  },
}));

import { needsMissedCallTemplate, sendMissedCallTemplate } from "./missed-call-template";

// Same minimal chainable/thenable query-builder stand-in used across this
// project's other Supabase-backed tests, keyed per-table (createFakeSupabase).
type QueryResult = { data?: unknown; error?: { code?: string; message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
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

describe("needsMissedCallTemplate -- R-FUP-002 (docs/BLUEPRINT_V1.md Section 8)", () => {
  it("no_answer and busy need it", () => {
    expect(needsMissedCallTemplate("no_answer")).toBe(true);
    expect(needsMissedCallTemplate("busy")).toBe(true);
  });

  it("answered, wrong_number, and not_interested do not", () => {
    expect(needsMissedCallTemplate("answered")).toBe(false);
    expect(needsMissedCallTemplate("wrong_number")).toBe(false);
    expect(needsMissedCallTemplate("not_interested")).toBe(false);
  });
});

describe("sendMissedCallTemplate", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sendTemplateMessageMock.mockReset().mockResolvedValue({ waMessageId: "wamid.1" });
    process.env.WHATSAPP_MISSED_CALL_TEMPLATE_NAME = "missed_call_followup";
    process.env.WHATSAPP_MISSED_CALL_TEMPLATE_LANGUAGE = "en";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns not_configured, and never queries anything, when no template name is set -- no fake/pretend send", async () => {
    delete process.env.WHATSAPP_MISSED_CALL_TEMPLATE_NAME;
    const { stub, from } = createFakeSupabase({});
    expect(await sendMissedCallTemplate(stub, "lead-1")).toEqual({ status: "not_configured" });
    expect(from).not.toHaveBeenCalled();
    expect(sendTemplateMessageMock).not.toHaveBeenCalled();
  });

  it("returns opted_out and never sends, for an opted-out lead", async () => {
    const { stub } = createFakeSupabase({ leads: [{ data: { opted_out_at: "2026-10-30T00:00:00Z" }, error: null }] });
    expect(await sendMissedCallTemplate(stub, "lead-1")).toEqual({ status: "opted_out" });
    expect(sendTemplateMessageMock).not.toHaveBeenCalled();
  });

  it("returns no_conversation when the lead has no WhatsApp conversation to send through", async () => {
    const { stub } = createFakeSupabase({
      leads: [{ data: { opted_out_at: null }, error: null }],
      conversations: [{ data: null, error: null }],
    });
    expect(await sendMissedCallTemplate(stub, "lead-1")).toEqual({ status: "no_conversation" });
    expect(sendTemplateMessageMock).not.toHaveBeenCalled();
  });

  it("on success: sends the template, records an outbound message, and touches the conversation", async () => {
    const { stub, from } = createFakeSupabase({
      leads: [{ data: { opted_out_at: null }, error: null }],
      conversations: [{ data: { id: "conv-1", wa_id: "919999999999", phone_number_id: "pn-1" }, error: null }],
      messages: [{ data: null, error: null }],
    });

    const result = await sendMissedCallTemplate(stub, "lead-1");

    expect(result).toEqual({ status: "sent" });
    expect(sendTemplateMessageMock).toHaveBeenCalledWith("pn-1", "919999999999", "missed_call_followup", "en");
    expect(from).toHaveBeenCalledWith("messages");
    expect(from).toHaveBeenCalledWith("conversations");
  });

  it("returns failed (not a thrown error) when the Meta send itself fails", async () => {
    const { SendMessageError } = await import("@/lib/whatsapp/send-message");
    sendTemplateMessageMock.mockRejectedValue(new SendMessageError("meta_api_error", "boom", "WhatsApp rejected it"));
    const { stub } = createFakeSupabase({
      leads: [{ data: { opted_out_at: null }, error: null }],
      conversations: [{ data: { id: "conv-1", wa_id: "919999999999", phone_number_id: "pn-1" }, error: null }],
    });
    expect(await sendMissedCallTemplate(stub, "lead-1")).toEqual({ status: "failed", reason: "WhatsApp rejected it" });
  });
});
