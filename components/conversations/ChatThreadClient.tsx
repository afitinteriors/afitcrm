"use client";

import Link from "next/link";
import { MessageThread } from "@/components/conversations/MessageThread";
import { MobileChatHeader } from "@/components/conversations/MobileChatHeader";
import { LeadDetailsContent } from "@/components/conversations/LeadDetailsContent";
import { ReplyComposer } from "@/components/conversations/ReplyComposer";
import { useLiveMessages } from "@/lib/realtime/conversations";
import type { ConversationDetail, MessageListItem } from "@/lib/conversations";

// Same reasoning as ConversationThreadClient: useLiveMessages is called
// once here and its result passed to both MessageThread render slots, so
// /chat never opens two subscriptions for the same conversation. Layout/
// markup unchanged from before Phase 4b.3.
export function ChatThreadClient({
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
      {/* Mobile: full-screen thread, its own screen. */}
      <div className="flex h-full flex-col lg:hidden">
        <MobileChatHeader name={name} subtitle={subtitle} lead={conversation.lead} backHref="/chat" />
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#e7ede9] p-3" data-scroll-container>
          <MessageThread messages={messages} lastUpdateSource={lastUpdateSource} />
        </div>
        <ReplyComposer conversationId={conversation.id} />
      </div>

      {/* Desktop: thread column + persistent contact panel column. */}
      <div className="hidden h-full lg:flex">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14342a] text-sm font-semibold text-white">
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{name}</p>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              </div>
            </div>
            <Link href="/chat" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              ← Conversations
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#e7ede9] p-4" data-scroll-container>
            <MessageThread messages={messages} lastUpdateSource={lastUpdateSource} />
          </div>
          <ReplyComposer conversationId={conversation.id} />
        </div>

        <div className="w-[320px] shrink-0 overflow-y-auto border-l border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Contact</p>
          </div>
          <LeadDetailsContent lead={conversation.lead} />
        </div>
      </div>
    </>
  );
}
