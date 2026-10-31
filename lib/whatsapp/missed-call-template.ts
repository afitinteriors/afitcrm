import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CallOutcome } from "@/lib/supabase/types";
import { sendTemplateMessage, SendMessageError } from "@/lib/whatsapp/send-message";

// R-FUP-002 (docs/BLUEPRINT_V1.md Section 8): "If a call is not answered,
// the customer gets an approved WhatsApp template." "Not answered" covers
// both outcomes where we genuinely couldn't reach a person -- "no answer"
// and "busy" -- not "wrong_number" (no such person to message) or
// "not_interested" (we DID reach them; a template nudge would be unwanted).
const MISSED_CALL_OUTCOMES: readonly CallOutcome[] = ["no_answer", "busy"];

export function needsMissedCallTemplate(outcome: CallOutcome): boolean {
  return MISSED_CALL_OUTCOMES.includes(outcome);
}

const DEFAULT_PREVIEW_BODY = "We tried to call you from AFIT. When is a good time?";

export type MissedCallTemplateResult =
  | { status: "sent" }
  | { status: "not_configured" }
  | { status: "opted_out" }
  | { status: "no_conversation" }
  | { status: "failed"; reason: string };

// Always sent as a TEMPLATE, never sendTextMessage's free-form type -- a
// missed call almost always means the customer hasn't messaged recently,
// so the 24-hour free-form window is very likely already closed, and a
// template is the correct message type for business-initiated
// re-engagement regardless of window state. The template itself must
// already be created and approved in Meta Business Manager -- this never
// invents or guesses a template name; with WHATSAPP_MISSED_CALL_TEMPLATE_NAME
// unset, it returns "not_configured" rather than attempting a send Meta
// would reject (or worse, silently pretending to send one -- CLAUDE.md:
// "No fake numbers, dead buttons or pretend integrations").
export async function sendMissedCallTemplate(supabase: SupabaseClient<Database>, leadId: string): Promise<MissedCallTemplateResult> {
  const templateName = process.env.WHATSAPP_MISSED_CALL_TEMPLATE_NAME;
  if (!templateName) return { status: "not_configured" };
  const languageCode = process.env.WHATSAPP_MISSED_CALL_TEMPLATE_LANGUAGE || "en";
  const previewBody = process.env.WHATSAPP_MISSED_CALL_TEMPLATE_PREVIEW || DEFAULT_PREVIEW_BODY;

  const { data: lead } = await supabase.from("leads").select("opted_out_at").eq("id", leadId).maybeSingle();
  if (lead?.opted_out_at) return { status: "opted_out" };

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, wa_id, phone_number_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) return { status: "no_conversation" };

  let result;
  try {
    result = await sendTemplateMessage(conversation.phone_number_id, conversation.wa_id, templateName, languageCode);
  } catch (err) {
    const reason = err instanceof SendMessageError ? err.publicMessage : "Could not send the missed-call message.";
    return { status: "failed", reason };
  }

  // previewBody (not the real approved template body, which this app
  // never fetches from Meta) is recorded only so staff see a readable
  // record of what kind of message went out -- same reasoning as every
  // other outbound insert in this codebase (lib/actions/messages.ts,
  // lib/automations/outbound-sender.ts): message_type has no CHECK
  // constraint, so "text" here is just the closest existing label, not a
  // claim that Meta treated this as free-form.
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    wa_message_id: result.waMessageId,
    direction: "outbound",
    message_type: "text",
    body: previewBody,
    status: "sent",
  });

  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.id);

  return { status: "sent" };
}
