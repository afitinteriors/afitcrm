import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { draftFirstReply } from "@/lib/ai/first-reply";
import { deliverAiMessage } from "@/lib/ai/deliver";

export type AiDraftTriggerParams = {
  conversationId: string;
  leadId: string | null;
  messageBody: string | null;
};

// Blueprint V1 Phase 6: called from lib/whatsapp/ingest.ts right after
// triggerAutomationForMessage, ONLY when that returned "no_match" -- an
// admin-configured automation flow already owning this conversation takes
// priority; the AI agent is a fallback for leads nothing else is handling,
// never a second reply racing an automation's own. Best-effort, same as
// automation triggering: the caller catches, this never blocks message
// ingestion.
//
// Scoped to the FIRST response only -- a brand new conversation, nothing
// asked yet. Increment 2's lib/ai/session-trigger.ts picks up everything
// after that (lib/whatsapp/ingest.ts checks for an active session before
// ever reaching this function, so the two never both fire for the same
// message). Skipped entirely once this conversation has sent any outbound
// message, or already has an undealt-with pending draft.
export async function triggerAiDraftForMessage(supabase: SupabaseClient<Database>, params: AiDraftTriggerParams): Promise<void> {
  if (!params.leadId || !params.messageBody) return;

  const { data: settings } = await supabase.from("ai_agent_settings").select("enabled, mode").eq("id", true).single();
  if (!settings?.enabled) return;

  const [{ count: outboundCount }, { data: conversation }] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", params.conversationId).eq("direction", "outbound"),
    supabase.from("conversations").select("pending_ai_draft").eq("id", params.conversationId).single(),
  ]);
  if ((outboundCount ?? 0) > 0) return;
  if (conversation?.pending_ai_draft) return;

  const { data: lead } = await supabase
    .from("leads")
    .select("service_required, project_type, location, estimated_sqft, expected_start_date")
    .eq("id", params.leadId)
    .single();
  if (!lead) return;

  const draft = await draftFirstReply({ ...lead, messageBody: params.messageBody });
  if (!draft) return; // Gemini not configured -- skip silently, same as the not_configured guard elsewhere.

  await deliverAiMessage(supabase, { conversationId: params.conversationId, mode: settings.mode, text: draft.text, kind: "question", field: draft.field });
}
