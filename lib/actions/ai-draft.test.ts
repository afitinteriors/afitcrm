import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
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

let fakeSupabase: SupabaseClient<Database>;
vi.mock("@/lib/supabase/server", () => ({ createClient: () => fakeSupabase }));

const getCurrentProfileMock = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentProfile: () => getCurrentProfileMock() }));

const recordAuditEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit", () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEventMock(...args) }));

const sendTextMessageMock = vi.fn();
vi.mock("@/lib/whatsapp/send-message", () => {
  class FakeSendMessageError extends Error {
    publicMessage: string;
    constructor(_code: string, message: string, publicMessage?: string) {
      super(message);
      this.publicMessage = publicMessage ?? message;
    }
  }
  return {
    sendTextMessage: (...args: unknown[]) => sendTextMessageMock(...args),
    SendMessageError: FakeSendMessageError,
  };
});

const handOffActiveSessionMock = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/automations/sessions", () => ({ handOffActiveSession: (...args: unknown[]) => handOffActiveSessionMock(...args) }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { sendAiDraft, discardAiDraft } from "./ai-draft";
import { SendMessageError } from "@/lib/whatsapp/send-message";

function formDataWith(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const ADMIN_PROFILE = { id: "admin-1", role: "admin" as const };

describe("sendAiDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
    sendTextMessageMock.mockResolvedValue({ waMessageId: "wam-1" });
  });

  it("rejects a missing conversation_id or empty text", async () => {
    expect(await sendAiDraft(null, formDataWith({ text: "hi" }))).toEqual({ error: "Missing conversation." });
    expect(await sendAiDraft(null, formDataWith({ conversation_id: "c1", text: "  " }))).toEqual({ error: "Message can't be empty." });
    expect(sendTextMessageMock).not.toHaveBeenCalled();
  });

  it("requires a signed-in profile", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    fakeSupabase = createFakeSupabase({}).stub;
    expect(await sendAiDraft(null, formDataWith({ conversation_id: "c1", text: "hi" }))).toEqual({ error: "Not signed in." });
  });

  it("rejects when the conversation isn't accessible", async () => {
    fakeSupabase = createFakeSupabase({ conversations: [{ data: null }] }).stub;
    expect(await sendAiDraft(null, formDataWith({ conversation_id: "c1", text: "hi" }))).toEqual({ error: "You do not have access to this conversation." });
  });

  it("sends, persists, clears the draft, hands off the session and audits", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [{ data: { id: "c1", wa_id: "wa1", phone_number_id: "pn1" } }, { error: null }],
      messages: [{ data: { id: "msg-1" }, error: null }],
    });
    fakeSupabase = stub;

    const result = await sendAiDraft(null, formDataWith({ conversation_id: "c1", text: "Sure, could you share the location?" }));

    expect(result).toBeNull();
    expect(sendTextMessageMock).toHaveBeenCalledWith("pn1", "wa1", "Sure, could you share the location?");
    expect(from).toHaveBeenCalledWith("messages");
    expect(handOffActiveSessionMock).toHaveBeenCalledWith(fakeSupabase, "c1");
    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ action: "message_sent", metadata: { message_type: "text", source: "ai_draft" } }));
  });

  it("surfaces the SendMessageError's public message on send failure", async () => {
    fakeSupabase = createFakeSupabase({ conversations: [{ data: { id: "c1", wa_id: "wa1", phone_number_id: "pn1" } }] }).stub;
    sendTextMessageMock.mockRejectedValue(new SendMessageError("meta_api_error", "internal", "WhatsApp did not accept this message."));

    expect(await sendAiDraft(null, formDataWith({ conversation_id: "c1", text: "hi" }))).toEqual({ error: "WhatsApp did not accept this message." });
  });
});

describe("discardAiDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue(ADMIN_PROFILE);
  });

  it("rejects a missing conversation_id", async () => {
    expect(await discardAiDraft(null, formDataWith({}))).toEqual({ error: "Missing conversation." });
  });

  it("clears the draft without sending anything", async () => {
    const { stub, from } = createFakeSupabase({ conversations: [{ data: { id: "c1" } }, { error: null }] });
    fakeSupabase = stub;

    const result = await discardAiDraft(null, formDataWith({ conversation_id: "c1" }));

    expect(result).toBeNull();
    expect(sendTextMessageMock).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("conversations");
  });
});
