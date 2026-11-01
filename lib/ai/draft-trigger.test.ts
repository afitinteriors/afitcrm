import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const draftFirstReplyMock = vi.fn();
vi.mock("@/lib/ai/first-reply", () => ({
  draftFirstReply: (...args: unknown[]) => draftFirstReplyMock(...args),
}));

const sendTextMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/automations/outbound-sender", () => ({
  RealOutboundSender: vi.fn().mockImplementation(() => ({ sendText: sendTextMock })),
}));

import { triggerAiDraftForMessage } from "./draft-trigger";

type Script = {
  settings?: { enabled: boolean; mode: "draft" | "automatic" } | null;
  outboundCount?: number;
  pendingDraft?: string | null;
  lead?: Record<string, unknown> | null;
};

function createFakeSupabase(script: Script) {
  const updateCalls: { table: string; payload: unknown }[] = [];

  const from = vi.fn((table: string) => {
    if (table === "ai_agent_settings") {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: script.settings ?? null, error: null }) }) }) };
    }
    if (table === "messages") {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: script.outboundCount ?? 0, error: null }) }) }) };
    }
    if (table === "conversations") {
      return {
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { pending_ai_draft: script.pendingDraft ?? null }, error: null }) }) }),
        update: (payload: unknown) => {
          updateCalls.push({ table, payload });
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    }
    if (table === "leads") {
      return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: script.lead ?? null, error: null }) }) }) };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { stub: { from } as unknown as SupabaseClient<Database>, updateCalls };
}

const LEAD = { service_required: "Gypsum", project_type: null, location: null, estimated_sqft: null, expected_start_date: null };

describe("triggerAiDraftForMessage", () => {
  beforeEach(() => {
    draftFirstReplyMock.mockReset().mockResolvedValue("Hi! Could you share your site location?");
    sendTextMock.mockClear();
  });

  it("does nothing when leadId or messageBody is missing", async () => {
    const { stub } = createFakeSupabase({});
    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: null, messageBody: "hi" });
    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: null });
    expect(draftFirstReplyMock).not.toHaveBeenCalled();
  });

  it("does nothing when the agent is disabled", async () => {
    const { stub } = createFakeSupabase({ settings: { enabled: false, mode: "draft" } });
    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });
    expect(draftFirstReplyMock).not.toHaveBeenCalled();
  });

  it("does nothing when settings row is missing", async () => {
    const { stub } = createFakeSupabase({ settings: null });
    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });
    expect(draftFirstReplyMock).not.toHaveBeenCalled();
  });

  it("does nothing once an outbound message already exists on this conversation", async () => {
    const { stub } = createFakeSupabase({ settings: { enabled: true, mode: "draft" }, outboundCount: 1 });
    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });
    expect(draftFirstReplyMock).not.toHaveBeenCalled();
  });

  it("does nothing when a pending draft already exists", async () => {
    const { stub } = createFakeSupabase({ settings: { enabled: true, mode: "draft" }, pendingDraft: "already drafted" });
    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });
    expect(draftFirstReplyMock).not.toHaveBeenCalled();
  });

  it("saves the draft to conversations.pending_ai_draft in draft mode", async () => {
    const { stub, updateCalls } = createFakeSupabase({ settings: { enabled: true, mode: "draft" }, lead: LEAD });

    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toMatchObject({ pending_ai_draft: "Hi! Could you share your site location?" });
  });

  it("sends immediately via RealOutboundSender in automatic mode, without saving a draft", async () => {
    const { stub, updateCalls } = createFakeSupabase({ settings: { enabled: true, mode: "automatic" }, lead: LEAD });

    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });

    expect(sendTextMock).toHaveBeenCalledWith("c1", "Hi! Could you share your site location?");
    expect(updateCalls).toHaveLength(0);
  });

  it("does nothing when the AI declines to draft (not configured)", async () => {
    draftFirstReplyMock.mockResolvedValue(null);
    const { stub, updateCalls } = createFakeSupabase({ settings: { enabled: true, mode: "draft" }, lead: LEAD });

    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(0);
  });

  it("does nothing when the lead no longer exists", async () => {
    const { stub } = createFakeSupabase({ settings: { enabled: true, mode: "draft" }, lead: null });
    await triggerAiDraftForMessage(stub, { conversationId: "c1", leadId: "l1", messageBody: "hi" });
    expect(draftFirstReplyMock).not.toHaveBeenCalled();
  });
});
