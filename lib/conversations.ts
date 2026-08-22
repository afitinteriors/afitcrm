import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ConversationRow, LeadRow, MessageRow } from "@/lib/supabase/types";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";

// Ownership is enforced by RLS (conversations_select_admin_or_owner /
// messages_select_admin_or_owner): admin sees everything, staff only
// conversations linked to a lead assigned to them, and an unassigned
// conversation (lead_id null) is admin-only since no staff can ever match
// it. Queries here use the session-scoped client so that enforcement always
// applies -- getCurrentProfile() is only checked to short-circuit to an
// empty result when there's no session at all.

export type ConversationListItem = ConversationRow & {
  lead: { customer_name: string | null; phone: string } | null;
};

// cache()-wrapped: the conversations layout (desktop list column) and the
// list/detail pages each need this, and previously each triggered its own
// full query. Memoized per-request so they share one result.
export const getConversations = cache(async (): Promise<ConversationListItem[]> => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*, lead:leads(customer_name, phone)")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ConversationListItem[];
});

export type ConversationDetail = ConversationRow & {
  lead: {
    id: string;
    customer_name: string | null;
    phone: string;
    status: LeadRow["status"];
    location: string | null;
    service_required: string | null;
  } | null;
};

export const getConversationById = cache(async (id: string): Promise<ConversationDetail | null> => {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*, lead:leads(id, customer_name, phone, status, location, service_required)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const conversation = data as unknown as ConversationDetail;

  await recordAuditEvent({
    actorId: profile.id,
    action: "conversation_viewed",
    targetType: "conversation",
    targetId: conversation.id,
  });

  return conversation;
});

// Excludes raw_payload -- the full raw Meta webhook JSON per message, which
// nothing in the viewer reads. Fetching it for every message in a thread was
// pure wasted payload weight.
export type MessageListItem = Omit<MessageRow, "raw_payload">;

const MESSAGE_LIST_COLUMNS =
  "id, conversation_id, wa_message_id, direction, message_type, body, media_id, media_storage_path, status, created_at, updated_at";

export async function getMessagesForConversation(conversationId: string): Promise<MessageListItem[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_LIST_COLUMNS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
