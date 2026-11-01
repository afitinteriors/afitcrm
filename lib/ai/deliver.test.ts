import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const sendTextMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/automations/outbound-sender", () => ({
  RealOutboundSender: vi.fn().mockImplementation(() => ({ sendText: sendTextMock })),
}));

import { deliverAiMessage, applyPostSendSessionState } from "./deliver";

function createFakeSupabase() {
  const updateCalls: { table: string; payload: unknown }[] = [];
  const from = vi.fn((table: string) => ({
    update: (payload: unknown) => {
      updateCalls.push({ table, payload });
      return { eq: () => Promise.resolve({ error: null }) };
    },
  }));
  return { stub: { from } as unknown as SupabaseClient<Database>, updateCalls };
}

describe("deliverAiMessage", () => {
  beforeEach(() => {
    sendTextMock.mockClear();
  });

  it("saves a pending draft (and nothing else) in draft mode", async () => {
    const { stub, updateCalls } = createFakeSupabase();
    await deliverAiMessage(stub, { conversationId: "c1", mode: "draft", text: "Where is the site?", kind: "question", field: "location" });

    expect(sendTextMock).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toMatchObject({
      pending_ai_draft: "Where is the site?",
      pending_ai_draft_kind: "question",
      pending_ai_draft_field: "location",
    });
  });

  it("sends immediately and starts the session in automatic mode for a question", async () => {
    const { stub, updateCalls } = createFakeSupabase();
    await deliverAiMessage(stub, { conversationId: "c1", mode: "automatic", text: "Where is the site?", kind: "question", field: "location" });

    expect(sendTextMock).toHaveBeenCalledWith("c1", "Where is the site?");
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toEqual({ ai_session_status: "asking", ai_pending_field: "location" });
  });

  it("sends and moves to confirming in automatic mode for a confirmation", async () => {
    const { stub, updateCalls } = createFakeSupabase();
    await deliverAiMessage(stub, { conversationId: "c1", mode: "automatic", text: "Is that right?", kind: "confirmation", field: null });

    expect(updateCalls[0].payload).toEqual({ ai_session_status: "confirming", ai_pending_field: null });
  });

  it("sends a closing message in automatic mode without touching session state", async () => {
    const { stub, updateCalls } = createFakeSupabase();
    await deliverAiMessage(stub, { conversationId: "c1", mode: "automatic", text: "Thanks!", kind: "closing", field: null });

    expect(sendTextMock).toHaveBeenCalledWith("c1", "Thanks!");
    expect(updateCalls).toHaveLength(0);
  });
});

describe("applyPostSendSessionState", () => {
  it("is a no-op for a closing message", async () => {
    const { stub, updateCalls } = createFakeSupabase();
    await applyPostSendSessionState(stub, "c1", "closing", null);
    expect(updateCalls).toHaveLength(0);
  });

  it("sets asking/field for a question", async () => {
    const { stub, updateCalls } = createFakeSupabase();
    await applyPostSendSessionState(stub, "c1", "question", "estimated_sqft");
    expect(updateCalls[0].payload).toEqual({ ai_session_status: "asking", ai_pending_field: "estimated_sqft" });
  });

  it("sets confirming with no pending field for a confirmation", async () => {
    const { stub, updateCalls } = createFakeSupabase();
    await applyPostSendSessionState(stub, "c1", "confirmation", null);
    expect(updateCalls[0].payload).toEqual({ ai_session_status: "confirming", ai_pending_field: null });
  });
});
