import { notFound } from "next/navigation";
import Link from "next/link";
import { getConversationById, getMessagesForConversation } from "@/lib/conversations";
import { MessageBubble } from "@/components/conversations/MessageBubble";
import { MobileChatHeader } from "@/components/conversations/MobileChatHeader";
import { LeadDetailsContent } from "@/components/conversations/LeadDetailsContent";
import { ReplyComposer } from "@/components/conversations/ReplyComposer";

export default async function ConversationDetailPage({ params }: PageProps<"/conversations/[id]">) {
  const { id } = await params;

  // Independent, RLS-scoped by the same conversation id -- fetched in
  // parallel rather than waiting on the conversation lookup first.
  const [conversation, messages] = await Promise.all([
    getConversationById(id),
    getMessagesForConversation(id),
  ]);
  if (!conversation) notFound();

  const name = conversation.lead?.customer_name || "Unlinked conversation";
  const subtitle = conversation.lead?.phone || conversation.wa_id;

  return (
    <>
      {/* Mobile: full-screen thread. List and lead details are separate
          screens/sheets, not columns -- this is not a shrunk desktop view. */}
      <div className="flex h-[calc(100vh-13rem)] flex-col lg:hidden">
        <MobileChatHeader name={name} subtitle={subtitle} lead={conversation.lead} />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No messages in this conversation yet.</p>
          )}
        </div>
        <ReplyComposer conversationId={conversation.id} />
      </div>

      {/* Desktop: three-column workspace -- this thread is the center
          column, lead details are an always-visible right column. */}
      <div className="hidden h-full lg:flex lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{name}</p>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
            <Link href="/conversations" className="text-xs font-medium text-slate-500 hover:text-slate-700">
              ← Back
            </Link>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {messages.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-500">No messages in this conversation yet.</p>
            )}
          </div>
          <ReplyComposer conversationId={conversation.id} />
        </div>

        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Lead details</p>
          </div>
          <LeadDetailsContent lead={conversation.lead} />
        </div>
      </div>
    </>
  );
}
