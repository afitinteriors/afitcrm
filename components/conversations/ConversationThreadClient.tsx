"use client";

import Link from "next/link";
import { MobileChatHeader } from "@/components/conversations/MobileChatHeader";
import { LeadDetailsContent } from "@/components/conversations/LeadDetailsContent";
import { ReplyComposer } from "@/components/conversations/ReplyComposer";
import { LiveMessageList } from "@/components/conversations/LiveMessageList";
import { useLiveMessages } from "@/lib/realtime/conversations";
import type { ConversationDetail, MessageListItem } from "@/lib/conversations";

// Client wrapper so the live-messages subscription (useLiveMessages) is
// called exactly once per page and its result fed to both the mobile and
// desktop render slots below -- calling the hook inside each slot
// separately would open two Realtime subscriptions for the same
// conversation. Layout/markup is otherwise unchanged from before Phase
// 4b.3; only where the `messages` array comes from has moved.
export function ConversationThreadClient({
  conversation,
  initialMessages,
}: {
  conversation: ConversationDetail;
  initialMessages: MessageListItem[];
}) {
  const { messages, lastUpdateSource } = useLiveMessages(conversation.id, initialMessages);
  const name = conversation.lead?.customer_name || "Unlinked conversation";
  const subtitle = conversation.lead?.phone || conversation.wa_id;

  return (
    <>
      {/* Mobile: full-screen thread. List and lead details are separate
          screens/sheets, not columns -- this is not a shrunk desktop view. */}
      <div className="flex h-[calc(100vh-13rem)] flex-col lg:hidden">
        <MobileChatHeader name={name} subtitle={subtitle} lead={conversation.lead} />
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-3" data-scroll-container>
          <LiveMessageList messages={messages} lastUpdateSource={lastUpdateSource} />
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
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4" data-scroll-container>
            <LiveMessageList messages={messages} lastUpdateSource={lastUpdateSource} />
          </div>
          <ReplyComposer conversationId={conversation.id} />
        </div>

        <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Lead details</p>
          </div>
          <LeadDetailsContent lead={conversation.lead} />
        </div>
      </div>
    </>
  );
}
