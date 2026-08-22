import { getConversations } from "@/lib/conversations";
import { ConversationListPanel } from "@/components/conversations/ConversationListPanel";

// Desktop: persistent conversations list in a left column, with `children`
// (the list page or a conversation thread) filling the rest. Mobile gets
// none of this -- each page renders its own full-screen view instead, since
// list and thread are genuinely separate mobile screens, not columns.
export default async function ConversationsLayout({ children }: LayoutProps<"/conversations">) {
  const conversations = await getConversations();

  return (
    <div className="lg:flex lg:h-[75vh] lg:gap-4 lg:overflow-hidden">
      <div className="hidden lg:flex lg:w-80 lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h1 className="text-sm font-semibold text-slate-900">Conversations</h1>
        </div>
        <ConversationListPanel conversations={conversations} />
      </div>

      <div className="lg:min-w-0 lg:flex-1 lg:overflow-hidden">{children}</div>
    </div>
  );
}
