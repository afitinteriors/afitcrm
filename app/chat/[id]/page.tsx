import { notFound } from "next/navigation";
import Link from "next/link";
import { getConversationById, getMessagesForConversation } from "@/lib/conversations";
import { MessageThread } from "@/components/conversations/MessageThread";
import { MobileChatHeader } from "@/components/conversations/MobileChatHeader";
import { LeadDetailsContent } from "@/components/conversations/LeadDetailsContent";
import { ReplyComposer } from "@/components/conversations/ReplyComposer";

export default async function ChatThreadPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;

  const [conversation, messages] = await Promise.all([
    getConversationById(id),
    getMessagesForConversation(id),
  ]);
  if (!conversation) notFound();

  const name = conversation.lead?.customer_name || "Unlinked conversation";
  const subtitle = conversation.lead?.phone || conversation.wa_id;

  return (
    <>
      {/* Mobile: full-screen thread, its own screen. */}
      <div className="flex h-full flex-col lg:hidden">
        <MobileChatHeader name={name} subtitle={subtitle} lead={conversation.lead} backHref="/chat" />
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#e7ede9] p-3">
          <MessageThread messages={messages} />
        </div>
        <ReplyComposer conversationId={conversation.id} />
      </div>

      {/* Desktop: thread column + persistent contact panel column. */}
      <div className="hidden h-full lg:flex">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14342a] text-sm font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{name}</p>
                <p className="text-xs text-slate-500">{subtitle}</p>
              </div>
            </div>
            <Link href="/chat" className="text-xs font-medium text-slate-500 hover:text-slate-700">
              ← Conversations
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#e7ede9] p-4">
            <MessageThread messages={messages} />
          </div>
          <ReplyComposer conversationId={conversation.id} />
        </div>

        <div className="w-[320px] shrink-0 overflow-y-auto border-l border-slate-100">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Contact</p>
          </div>
          <LeadDetailsContent lead={conversation.lead} />
        </div>
      </div>
    </>
  );
}
