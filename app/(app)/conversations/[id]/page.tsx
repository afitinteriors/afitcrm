import { notFound } from "next/navigation";
import { getConversationById, getMessagesForConversation } from "@/lib/conversations";
import { ConversationThreadClient } from "@/components/conversations/ConversationThreadClient";

export default async function ConversationDetailPage({ params }: PageProps<"/conversations/[id]">) {
  const { id } = await params;

  // Independent, RLS-scoped by the same conversation id -- fetched in
  // parallel rather than waiting on the conversation lookup first.
  const [conversation, messages] = await Promise.all([
    getConversationById(id),
    getMessagesForConversation(id),
  ]);
  if (!conversation) notFound();

  return <ConversationThreadClient conversation={conversation} initialMessages={messages} />;
}
