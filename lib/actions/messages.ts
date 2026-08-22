"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { sendTextMessage, SendMessageError } from "@/lib/whatsapp/send-message";

export type SendMessageState = { error: string } | null;

const MAX_BODY_LENGTH = 4096;

// Authorization is not duplicated here -- the session-scoped client below
// is subject to the same RLS policies already enforcing lead ownership for
// every other read/write in this app (conversations_select_admin_or_owner,
// messages_insert_admin_or_owner): admin can act on any conversation, staff
// only on one linked to a lead assigned to them, and an unassigned
// conversation has no staff owner. If the select below returns nothing,
// the caller either isn't authorized or the conversation doesn't exist --
// both fail closed to the same "no access" error.
export async function sendMessage(_prevState: SendMessageState, formData: FormData): Promise<SendMessageState> {
  const conversationId = String(formData.get("conversation_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!conversationId) return { error: "Missing conversation." };
  if (!body) return { error: "Message can't be empty." };
  if (body.length > MAX_BODY_LENGTH) return { error: "Message is too long." };

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
    result = await sendTextMessage(conversation.phone_number_id, conversation.wa_id, body);
  } catch (err) {
    if (err instanceof SendMessageError) return { error: err.publicMessage };
    return { error: "Could not send message. Please try again." };
  }

  // Meta has already accepted and sent the message by this point -- from
  // here on we're only recording it, not deciding whether to send it.
  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      wa_message_id: result.waMessageId,
      direction: "outbound",
      message_type: "text",
      body,
      status: "sent",
    })
    .select("id")
    .single();

  if (insertError) {
    return { error: "Message was sent, but saving it to the conversation failed. Refresh to check." };
  }

  // Audit metadata never includes the message body (AGENTS.md: don't log
  // message contents).
  await recordAuditEvent({
    actorId: profile.id,
    action: "message_sent",
    targetType: "message",
    targetId: inserted.id,
    metadata: { message_type: "text" },
  });

  // Bumps the conversation to the top of the list / refreshes its "time
  // ago" label. Only reached after the message insert above succeeded --
  // there's still no DB trigger for this (none exist anywhere in this
  // schema), so it's done explicitly here, matching how every other update
  // in this codebase is written directly rather than relying on one.
  const { error: touchError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  if (touchError) {
    console.error("Failed to update conversation updated_at after send:", touchError.message);
  }

  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath("/conversations");
  return null;
}
