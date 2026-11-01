import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AiAgentMode, AiDraftKind, QualificationField } from "@/lib/supabase/types";
import { RealOutboundSender } from "@/lib/automations/outbound-sender";

export type DeliverAiMessageInput = {
  conversationId: string;
  mode: AiAgentMode;
  text: string;
  kind: AiDraftKind;
  field: QualificationField | null;
};

// Blueprint V1 Phase 6: the one place that actually branches on
// draft-vs-automatic mode, shared by every AI trigger (increment 1's
// first reply, increment 2's follow-up questions/confirmation/closing) so
// the mode check is never duplicated or allowed to drift between them.
export async function deliverAiMessage(supabase: SupabaseClient<Database>, input: DeliverAiMessageInput): Promise<void> {
  if (input.mode === "automatic") {
    const sender = new RealOutboundSender(supabase);
    await sender.sendText(input.conversationId, input.text);
    await applyPostSendSessionState(supabase, input.conversationId, input.kind, input.field);
    return;
  }

  const { error } = await supabase
    .from("conversations")
    .update({
      pending_ai_draft: input.text,
      pending_ai_draft_created_at: new Date().toISOString(),
      pending_ai_draft_kind: input.kind,
      pending_ai_draft_field: input.field,
    })
    .eq("id", input.conversationId);
  if (error) {
    throw new Error(`Failed to save the AI's pending draft: ${error.message}`);
  }
}

// Called once a drafted question/confirmation has actually been SENT
// (either automatically here, or by a staff tap in
// lib/actions/ai-draft.ts's sendAiDraft) -- never at draft time, since
// "asking"/"confirming" means the customer genuinely received it. A
// 'closing' message needs no session-state change: the session was
// already ended (lib/ai/session-trigger.ts) before a closing message is
// ever queued.
export async function applyPostSendSessionState(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  kind: AiDraftKind,
  field: QualificationField | null,
): Promise<void> {
  if (kind === "closing") return;

  const { error } = await supabase
    .from("conversations")
    .update({
      ai_session_status: kind === "question" ? "asking" : "confirming",
      ai_pending_field: kind === "question" ? field : null,
    })
    .eq("id", conversationId);
  if (error) {
    console.error("Failed to update AI session state after send:", error.message);
  }
}
