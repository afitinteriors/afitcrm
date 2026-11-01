import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

const nextMissingFieldMock = vi.fn();
const draftQuestionMock = vi.fn();
const extractAnswerMock = vi.fn();
const classifyConfirmationMock = vi.fn();
const formatConfirmationSummaryMock = vi.fn();
const describeKnownFieldsMock = vi.fn().mockReturnValue("Nothing confirmed yet.");
vi.mock("@/lib/ai/qualification", () => ({
  nextMissingField: (...args: unknown[]) => nextMissingFieldMock(...args),
  draftQuestion: (...args: unknown[]) => draftQuestionMock(...args),
  extractAnswer: (...args: unknown[]) => extractAnswerMock(...args),
  classifyConfirmation: (...args: unknown[]) => classifyConfirmationMock(...args),
  formatConfirmationSummary: (...args: unknown[]) => formatConfirmationSummaryMock(...args),
  describeKnownFields: (...args: unknown[]) => describeKnownFieldsMock(...args),
}));

const deliverAiMessageMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/ai/deliver", () => ({
  deliverAiMessage: (...args: unknown[]) => deliverAiMessageMock(...args),
}));

import { continueAiSession } from "./session-trigger";

type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.update = vi.fn(chain);
  builder.insert = vi.fn(chain);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

function createFakeSupabase(script: Record<string, QueryResult[]>) {
  const counters: Record<string, number> = {};
  const builders: { table: string; builder: Record<string, unknown> }[] = [];
  const from = vi.fn((table: string) => {
    const idx = counters[table] ?? 0;
    counters[table] = idx + 1;
    const queue = script[table] ?? [];
    const builder = makeBuilder(queue[idx] ?? { data: null, error: null });
    builders.push({ table, builder });
    return builder;
  });
  return { stub: { from } as unknown as SupabaseClient<Database>, from, builders };
}

const PARAMS = { conversationId: "c1", leadId: "l1", messageBody: "hi" };

beforeEach(() => {
  nextMissingFieldMock.mockReset();
  draftQuestionMock.mockReset();
  extractAnswerMock.mockReset();
  classifyConfirmationMock.mockReset();
  formatConfirmationSummaryMock.mockReset();
  deliverAiMessageMock.mockClear();
});

describe("continueAiSession", () => {
  it("returns false without querying anything when leadId or messageBody is missing", async () => {
    const { stub, from } = createFakeSupabase({});
    expect(await continueAiSession(stub, { conversationId: "c1", leadId: null, messageBody: "hi" })).toBe(false);
    expect(await continueAiSession(stub, { conversationId: "c1", leadId: "l1", messageBody: null })).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("returns false when there is no active session", async () => {
    const { stub } = createFakeSupabase({ conversations: [{ data: { ai_session_status: null } }] });
    expect(await continueAiSession(stub, PARAMS)).toBe(false);
  });

  it("claims the message but does nothing when a draft is still pending review", async () => {
    const { stub, from } = createFakeSupabase({
      conversations: [{ data: { ai_session_status: "asking", pending_ai_draft: "already drafted" } }],
    });
    expect(await continueAiSession(stub, PARAMS)).toBe(true);
    expect(from).not.toHaveBeenCalledWith("ai_agent_settings");
    expect(extractAnswerMock).not.toHaveBeenCalled();
  });

  it("claims the message but does nothing when the agent is disabled", async () => {
    const { stub } = createFakeSupabase({
      conversations: [{ data: { ai_session_status: "asking", pending_ai_draft: null } }],
      ai_agent_settings: [{ data: { enabled: false, mode: "draft" } }],
    });
    expect(await continueAiSession(stub, PARAMS)).toBe(true);
    expect(extractAnswerMock).not.toHaveBeenCalled();
  });

  describe("asking", () => {
    function baseScript(extra: Record<string, QueryResult[]> = {}) {
      return {
        conversations: [{ data: { ai_session_status: "asking", ai_pending_field: "location", ai_collected_data: {}, pending_ai_draft: null } }, { error: null }],
        ai_agent_settings: [{ data: { enabled: true, mode: "draft" } }],
        ...extra,
      };
    }

    it("does nothing when Gemini can't extract an answer (not configured)", async () => {
      extractAnswerMock.mockResolvedValue(null);
      const { stub } = createFakeSupabase(baseScript());
      expect(await continueAiSession(stub, PARAMS)).toBe(true);
      expect(deliverAiMessageMock).not.toHaveBeenCalled();
    });

    it("ends the session silently when the reply doesn't answer the question", async () => {
      extractAnswerMock.mockResolvedValue({ answered: false });
      const { stub, builders } = createFakeSupabase(baseScript());
      expect(await continueAiSession(stub, PARAMS)).toBe(true);
      const endUpdate = builders.filter((b) => b.table === "conversations")[1].builder.update as ReturnType<typeof vi.fn>;
      expect(endUpdate).toHaveBeenCalledWith({ ai_session_status: null, ai_pending_field: null, ai_collected_data: null });
      expect(deliverAiMessageMock).not.toHaveBeenCalled();
    });

    it("asks the next missing field after saving the answer", async () => {
      extractAnswerMock.mockResolvedValue({ answered: true, value: "Kollam" });
      nextMissingFieldMock.mockReturnValue("estimated_sqft");
      draftQuestionMock.mockResolvedValue("About how many sqft?");
      const { stub, builders } = createFakeSupabase(
        baseScript({ leads: [{ data: { service_required: "Gypsum", project_type: null, location: null, estimated_sqft: null, expected_start_date: null } }] }),
      );

      expect(await continueAiSession(stub, PARAMS)).toBe(true);

      const persistUpdate = builders.filter((b) => b.table === "conversations")[1].builder.update as ReturnType<typeof vi.fn>;
      expect(persistUpdate).toHaveBeenCalledWith({ ai_collected_data: { location: "Kollam" }, ai_session_status: null, ai_pending_field: null });
      expect(deliverAiMessageMock).toHaveBeenCalledWith(stub, { conversationId: "c1", mode: "draft", text: "About how many sqft?", kind: "question", field: "estimated_sqft" });
    });

    it("saves the answer even when Gemini can't draft the next question", async () => {
      extractAnswerMock.mockResolvedValue({ answered: true, value: "Kollam" });
      nextMissingFieldMock.mockReturnValue("estimated_sqft");
      draftQuestionMock.mockResolvedValue(null);
      const { stub, builders } = createFakeSupabase(
        baseScript({ leads: [{ data: { service_required: "Gypsum", project_type: null, location: null, estimated_sqft: null, expected_start_date: null } }] }),
      );

      expect(await continueAiSession(stub, PARAMS)).toBe(true);
      expect(builders.filter((b) => b.table === "conversations")).toHaveLength(2);
      expect(deliverAiMessageMock).not.toHaveBeenCalled();
    });

    it("moves to confirmation once every field is known", async () => {
      extractAnswerMock.mockResolvedValue({ answered: true, value: "Kollam" });
      nextMissingFieldMock.mockReturnValue(null);
      formatConfirmationSummaryMock.mockReturnValue("Gypsum, Kollam. Is that right?");
      const { stub } = createFakeSupabase(
        baseScript({ leads: [{ data: { service_required: "Gypsum", project_type: "New", location: "Kollam", estimated_sqft: 1200, expected_start_date: null } }] }),
      );

      expect(await continueAiSession(stub, PARAMS)).toBe(true);
      expect(deliverAiMessageMock).toHaveBeenCalledWith(stub, { conversationId: "c1", mode: "draft", text: "Gypsum, Kollam. Is that right?", kind: "confirmation", field: null });
    });
  });

  describe("confirming", () => {
    function baseScript(extra: Record<string, QueryResult[]> = {}) {
      return {
        conversations: [{ data: { ai_session_status: "confirming", ai_pending_field: null, ai_collected_data: { location: "Kollam" }, pending_ai_draft: null } }, { error: null }],
        ai_agent_settings: [{ data: { enabled: true, mode: "automatic" } }],
        ...extra,
      };
    }

    it("does nothing when Gemini can't classify the reply (not configured)", async () => {
      classifyConfirmationMock.mockResolvedValue(null);
      const { stub } = createFakeSupabase(baseScript());
      expect(await continueAiSession(stub, PARAMS)).toBe(true);
      expect(deliverAiMessageMock).not.toHaveBeenCalled();
    });

    it("ends the session without saving anything when not confirmed", async () => {
      classifyConfirmationMock.mockResolvedValue(false);
      const { stub, builders } = createFakeSupabase(baseScript());

      expect(await continueAiSession(stub, PARAMS)).toBe(true);

      expect(builders.some((b) => b.table === "leads")).toBe(false);
      const endUpdate = builders.filter((b) => b.table === "conversations")[1].builder.update as ReturnType<typeof vi.fn>;
      expect(endUpdate).toHaveBeenCalledWith({ ai_session_status: null, ai_pending_field: null, ai_collected_data: null });
      expect(deliverAiMessageMock).not.toHaveBeenCalled();
    });

    it("saves the collected fields, audits under the assigned staff member, and sends a closing message", async () => {
      classifyConfirmationMock.mockResolvedValue(true);
      const { stub, builders } = createFakeSupabase(
        baseScript({
          leads: [{ data: { assigned_to_id: "staff-1" } }, { error: null }],
          audit_logs: [{ error: null }],
        }),
      );

      expect(await continueAiSession(stub, PARAMS)).toBe(true);

      const leadsBuilders = builders.filter((b) => b.table === "leads");
      expect(leadsBuilders[1].builder.update).toHaveBeenCalledWith({ location: "Kollam" });
      const auditBuilders = builders.filter((b) => b.table === "audit_logs");
      expect(auditBuilders[0].builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ actor_id: "staff-1", action: "lead_updated", target_type: "lead", target_id: "l1", metadata: { fields_changed: ["location"], source: "ai_agent" } }),
      );
      expect(deliverAiMessageMock).toHaveBeenCalledWith(stub, expect.objectContaining({ conversationId: "c1", mode: "automatic", kind: "closing", field: null }));
    });

    it("skips the audit write for an unassigned lead but still saves and closes", async () => {
      classifyConfirmationMock.mockResolvedValue(true);
      const { stub, builders } = createFakeSupabase(
        baseScript({ leads: [{ data: { assigned_to_id: null } }, { error: null }] }),
      );

      expect(await continueAiSession(stub, PARAMS)).toBe(true);
      expect(builders.some((b) => b.table === "audit_logs")).toBe(false);
      expect(deliverAiMessageMock).toHaveBeenCalled();
    });

    it("ends the session without a closing message when the lead update fails", async () => {
      classifyConfirmationMock.mockResolvedValue(true);
      const { stub, builders } = createFakeSupabase(
        baseScript({ leads: [{ data: { assigned_to_id: "staff-1" } }, { error: { message: "db down" } }] }),
      );

      expect(await continueAiSession(stub, PARAMS)).toBe(true);
      expect(builders.some((b) => b.table === "audit_logs")).toBe(false);
      expect(deliverAiMessageMock).not.toHaveBeenCalled();
      const endUpdate = builders.filter((b) => b.table === "conversations")[1].builder.update as ReturnType<typeof vi.fn>;
      expect(endUpdate).toHaveBeenCalledWith({ ai_session_status: null, ai_pending_field: null, ai_collected_data: null });
    });
  });
});
