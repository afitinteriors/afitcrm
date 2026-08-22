import { Suspense } from "react";
import { getConversations } from "@/lib/conversations";
import { ConversationListPanel } from "@/components/conversations/ConversationListPanel";

async function ConversationListData() {
  const conversations = await getConversations();
  return <ConversationListPanel conversations={conversations} />;
}

function ListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-4 py-4">
          <div className="h-11 w-11 shrink-0 rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Desktop: persistent conversations list in a left column, with `children`
// (the list page or a conversation thread) filling the rest. Mobile gets
// none of this -- each page renders its own full-screen view instead, since
// list and thread are genuinely separate mobile screens, not columns.
//
// Not async: the shell (border, "Conversations" header) renders immediately;
// only the list itself waits on getConversations(), inside its own Suspense
// boundary, so this layout no longer blocks children from streaming either.
export default function ConversationsLayout({ children }: LayoutProps<"/conversations">) {
  return (
    <div className="lg:flex lg:h-[75vh] lg:gap-4 lg:overflow-hidden">
      <div className="hidden lg:flex lg:w-80 lg:shrink-0 lg:flex-col lg:overflow-hidden lg:rounded-xl lg:border lg:border-slate-200 lg:bg-white lg:shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h1 className="text-sm font-semibold text-slate-900">Conversations</h1>
        </div>
        <Suspense fallback={<ListSkeleton />}>
          <ConversationListData />
        </Suspense>
      </div>

      <div className="lg:min-w-0 lg:flex-1 lg:overflow-hidden">{children}</div>
    </div>
  );
}
