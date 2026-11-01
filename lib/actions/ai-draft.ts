"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { sendTextMessage, SendMessageError } from "@/lib/whatsapp/send-message";
import { handOffActiveSession } from "@/lib/automations/sessions";

export type AiDraftActionState = { error: string } | null;

const MAX_BODY_LENGTH = 4096;

// Blueprint V1 Phase 6: staff's three responses to a pending AI draft
// (lib/ai/draft-trigger.ts). Same RLS-scoped session client and
// authorization shape as lib/actions/messages.ts's sendMessage -- these
// are staff actions through the UI, never the service-role client Hermes/
// webhooks use.

// Sends the draft (verbatim, or edited -- `text` is whatever the textarea
// held at submit time, so "Send" after editing is the same action as
// "Send" unedited). Reuses sendTextMessage directly rather than
// RealOutboundSender -- that class is the automation executor's own
// integration point; this is a human clicking Send on something AI
// suggested, functionally identical to typing a reply, so it follows
// sendMessage's exact shape instead.
export async function sendAiDraft(_prevState: AiDraftActionState, formData: FormData): Promise<AiDraftActionState> {
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();

  if (!conversationId) return { error: "Missing conversation." };
  if (!text) return { error: "Message can't be empty." };
  if (text.length > MAX_BODY_LENGTH) return { error: "Message is too long." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, wa_id, phone_number_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError || !conversation) {
    return { error: "You do not have access to this conversation." };
  }

  let result;
  try {
    result = await sendTextMessage(conversation.phone_number_id, conversation.wa_id, text);
  } catch (err) {
    if (err instanceof SendMessageError) return { error: err.publicMessage };
    return { error: "Could not send message. Please try again." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({ conversation_id: conversation.id, wa_message_id: result.waMessageId, direction: "outbound", message_type: "text", body: text, status: "sent" })
    .select("id")
    .single();
  if (insertError) {
    return { error: "Message was sent, but saving it to the conversation failed. Refresh to check." };
  }

  await clearDraft(supabase, conversation.id);
  await handOffActiveSession(supabase, conversation.id);

  await recordAuditEvent({
    actorId: profile.id,
    action: "message_sent",
    targetType: "message",
    targetId: inserted.id,
    metadata: { message_type: "text", source: "ai_draft" },
  });

  revalidateConversation(conversationId);
  return null;
}

// Throws the draft away without sending. The AI gets another turn on this
// lead's NEXT inbound message (lib/ai/draft-trigger.ts only skips when a
// pending draft already exists, not after one was discarded).
export async function discardAiDraft(_prevState: AiDraftActionState, formData: FormData): Promise<AiDraftActionState> {
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  if (!conversationId) return { error: "Missing conversation." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data: conversation, error: convError } = await supabase.from("conversations").select("id").eq("id", conversationId).maybeSingle();
  if (convError || !conversation) {
    return { error: "You do not have access to this conversation." };
  }

  await clearDraft(supabase, conversation.id);
  revalidateConversation(conversationId);
  return null;
}

async function clearDraft(supabase: Awaited<ReturnType<typeof createClient>>, conversationId: string): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ pending_ai_draft: null, pending_ai_draft_created_at: null })
    .eq("id", conversationId);
  if (error) {
    console.error("Failed to clear AI draft:", error.message);
  }
}

function revalidateConversation(conversationId: string): void {
  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath("/conversations");
  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chat");
}
