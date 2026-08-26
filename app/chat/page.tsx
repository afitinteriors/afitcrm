import Link from "next/link";
import { getConversations } from "@/lib/conversations";
import { ConversationListPanel } from "@/components/conversations/ConversationListPanel";
import { SignOutButton } from "@/components/SignOutButton";

export default async function ChatPage() {
  const conversations = await getConversations();

  return (
    <>
      {/* Mobile: the list IS the screen -- the desktop persistent list column
          in ChatLayout is hidden below lg, so mobile needs its own render.
          ChatLayout's own header is also hidden below lg (single-header
          rule), so this screen carries its own minimal header. */}
      <div className="flex h-full flex-col lg:hidden">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 bg-[#14342a] px-3 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#caa24a] text-xs font-bold text-[#14342a]">
              A
            </span>
            <span className="text-sm font-semibold">AFIT Live Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex min-h-11 items-center rounded-md border border-white/25 px-2.5 text-xs font-medium text-white active:bg-white/10"
            >
              ← Back to CRM
            </Link>
            <SignOutButton className="flex min-h-11 items-center px-2.5 text-xs font-medium text-emerald-100/80 active:text-white" />
          </div>
        </div>
        <ConversationListPanel conversations={conversations} basePath="/chat" />
      </div>

      <div className="hidden h-full flex-col items-center justify-center text-center lg:flex">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef4f1] text-2xl">💬</div>
        <p className="mt-3 text-sm font-medium text-slate-900">Select a conversation</p>
        <p className="mt-1 text-sm text-slate-500">Choose a conversation from the list to start chatting.</p>
      </div>
    </>
  );
}
