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
export type ConversationPreview = {
  id: string;
  status: ConversationRow["status"];
  updated_at: string;
  lastMessage: {
    direction: MessageRow["direction"];
    body: string | null;
    message_type: string;
    created_at: string;
  } | null;
};

// Preview for the lead detail page's "WhatsApp Conversation" card. Unlike
// getConversationById, this deliberately does NOT record a conversation_viewed
// audit event -- that action means "opened the full thread", not "saw a
// snippet on another page". RLS (conversations_select_admin_or_owner) already
// scopes this to what the caller may see, mirroring leads_select_admin_or_owner
// exactly, so a staff caller can never preview a conversation for a lead that
// isn't theirs. A lead can have more than one conversations row (no unique
// constraint on lead_id), so this picks the most recently updated one rather
// than assuming exactly one exists.
export async function getConversationForLead(leadId: string): Promise<ConversationPreview | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, status, updated_at, messages(direction, body, message_type, created_at)")
    .eq("lead_id", leadId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false, referencedTable: "messages" })
    .limit(1)
    .limit(1, { referencedTable: "messages" })
    .maybeSingle();

  if (error || !data) return null;

  const { messages, ...conversation } = data as unknown as ConversationPreview & {
    messages: ConversationPreview["lastMessage"][];
  };

  return { ...conversation, lastMessage: messages?.[0] ?? null };
}

export type MessageListItem = Omit<MessageRow, "raw_payload">;

const MESSAGE_LIST_COLUMNS =
  "id, conversation_id, wa_message_id, direction, message_type, body, media_id, media_storage_path, status, created_at, updated_at";

export type UnansweredConversation = {
  id: string;
  wa_id: string;
  lastInboundAt: string;
  lead: {
    id: string;
    customer_name: string | null;
    assigned: { display_name: string | null } | null;
  } | null;
};

// "Unanswered" = the most recent message in the conversation is inbound,
// i.e. nothing outbound has gone out since the customer's last message.
// There's no denormalized "last message direction" column on conversations,
// so this reduces the full messages table (3 narrow columns only) in one
// query rather than one query per conversation -- at this CRM's current
// scale that's the simplest correct option; a materialized "last inbound
// at" column would be the next step if message volume grows much larger.
// RLS (messages_select_admin_or_owner) already scopes the messages query to
// what the caller may see, same as getMessagesForConversation.
export async function getUnansweredConversations(): Promise<UnansweredConversation[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("conversation_id, direction, created_at")
    .order("created_at", { ascending: false });
  if (messagesError) throw new Error(messagesError.message);

  const latestByConversation = new Map<string, { direction: string; created_at: string }>();
  for (const m of messages ?? []) {
    if (!latestByConversation.has(m.conversation_id)) {
      latestByConversation.set(m.conversation_id, { direction: m.direction, created_at: m.created_at });
    }
  }

  const unansweredIds = Array.from(latestByConversation.entries())
    .filter(([, latest]) => latest.direction === "inbound")
    .map(([conversationId]) => conversationId);
  if (unansweredIds.length === 0) return [];

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id, wa_id, lead:leads(id, customer_name, assigned:profiles(display_name))")
    .eq("status", "open")
    .in("id", unansweredIds);
  if (conversationsError) throw new Error(conversationsError.message);

  return ((conversations ?? []) as unknown as UnansweredConversation[])
    .map((c) => ({ ...c, lastInboundAt: latestByConversation.get(c.id)!.created_at }))
    .sort((a, b) => new Date(a.lastInboundAt).getTime() - new Date(b.lastInboundAt).getTime());
}

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
