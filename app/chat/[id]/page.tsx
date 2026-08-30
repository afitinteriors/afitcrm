import { notFound } from "next/navigation";
import { getConversationById, getMessagesForConversation } from "@/lib/conversations";
import { ChatThreadClient } from "@/components/conversations/ChatThreadClient";

export default async function ChatThreadPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;

  const [conversation, messages] = await Promise.all([
    getConversationById(id),
    getMessagesForConversation(id),
  ]);
  if (!conversation) notFound();

  return <ChatThreadClient conversation={conversation} initialMessages={messages} />;
}
