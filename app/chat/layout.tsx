import { Suspense } from "react";
import Link from "next/link";
import { getConversations } from "@/lib/conversations";
import { getCurrentProfile } from "@/lib/auth";
import { ConversationListPanel } from "@/components/conversations/ConversationListPanel";
import { SignOutButton } from "@/components/SignOutButton";

async function ConversationListData() {
  const conversations = await getConversations();
  return <ConversationListPanel conversations={conversations} basePath="/chat" />;
}

function ListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex animate-pulse items-center gap-3 px-3.5 py-3">
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

async function TopBarProfile() {
  const profile = await getCurrentProfile();
  return (
    <span className="hidden text-xs text-emerald-100/80 sm:inline">
      {profile?.displayName ?? ""}
    </span>
  );
}

// Deliberately outside app/(app) -- Live Chat is its own shell with no CRM
// sidebar and no CRM header. The only link back to the CRM is explicit, in
// the top bar below. Still gated by the same auth middleware (proxy.ts's
// matcher covers every route except /login and the webhook), so signed-out
// access is refused exactly as it is everywhere else in the app.
export default function ChatLayout({ children }: LayoutProps<"/chat">) {
  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Desktop-only shell chrome. On mobile, the list screen and the
          thread screen (via MobileChatHeader) each render their own single
          header instead -- stacking this on top of MobileChatHeader used to
          leave two headers competing for a phone-sized viewport. */}
      <header className="hidden h-14 shrink-0 items-center justify-between gap-3 bg-[#14342a] px-4 text-white shadow-sm lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#caa24a] text-xs font-bold text-[#14342a]">
            A
          </span>
          <span className="text-sm font-semibold">AFIT Live Chat</span>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <TopBarProfile />
          </Suspense>
          <Link
            href="/dashboard"
            className="rounded-md border border-white/25 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10"
          >
            ← Back to CRM
          </Link>
          <SignOutButton className="text-xs font-medium text-emerald-100/80 hover:text-white" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 lg:gap-px lg:bg-slate-200">
        <div className="hidden lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:bg-white">
          <Suspense fallback={<ListSkeleton />}>
            <ConversationListData />
          </Suspense>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden lg:bg-white">{children}</div>
      </div>
    </div>
  );
}
