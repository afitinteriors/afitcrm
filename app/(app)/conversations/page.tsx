import { getConversations } from "@/lib/conversations";
import { getCurrentProfile } from "@/lib/auth";
import { ConversationListPanel } from "@/components/conversations/ConversationListPanel";

export default async function ConversationsPage() {
  const [conversations, profile] = await Promise.all([getConversations(), getCurrentProfile()]);
  const heading = profile?.role === "staff" ? "My Conversations" : "Conversations";

  return (
    <>
      {/* Mobile: the list IS the screen. */}
      <div className="flex h-[calc(100vh-15rem)] flex-col lg:hidden">
        <h1 className="px-1 pb-3 text-xl font-semibold text-slate-900">{heading}</h1>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <ConversationListPanel conversations={conversations} />
        </div>
      </div>

      {/* Desktop: the list lives in the persistent layout column; this is
          just the center-pane empty state until a conversation is picked. */}
      <div className="hidden h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white text-center lg:flex">
        <p className="text-sm font-medium text-slate-900">Select a conversation</p>
        <p className="mt-1 text-sm text-slate-500">Choose a conversation from the list to view messages.</p>
      </div>
    </>
  );
}
