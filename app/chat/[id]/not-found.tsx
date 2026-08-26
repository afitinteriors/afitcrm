import Link from "next/link";

// Rendered in place of the thread whenever getConversationById() can't find
// (or can't authorize) the requested id -- e.g. a stale tab left open on a
// conversation that was since deleted. Renders inside app/chat/layout.tsx,
// so desktop keeps the shell header; mobile carries its own bar here since
// the shell header is hidden below lg (single-header rule).
export default function ChatConversationNotFound() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 bg-[#14342a] px-3 text-white shadow-sm lg:hidden">
        <Link
          href="/chat"
          aria-label="Back to conversations"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-white/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <span className="text-sm font-semibold">AFIT Live Chat</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef4f1] text-2xl">💬</div>
        <p className="mt-3 text-sm font-medium text-slate-900">Conversation not found</p>
        <p className="mt-1 text-sm text-slate-500">
          It may have been removed, or you no longer have access to it.
        </p>
        <Link
          href="/chat"
          className="mt-5 flex min-h-11 items-center rounded-lg bg-[#14342a] px-4 text-sm font-medium text-white active:bg-[#0d241d]"
        >
          Back to conversations
        </Link>
      </div>
    </div>
  );
}
