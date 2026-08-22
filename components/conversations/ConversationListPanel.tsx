"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { formatRelative } from "@/lib/format";
import type { ConversationListItem } from "@/lib/conversations";

const STATUS_DOT: Record<string, string> = {
  open: "bg-emerald-500",
  closed: "bg-slate-300",
};

export function ConversationListPanel({ conversations }: { conversations: ConversationListItem[] }) {
  const router = useRouter();
  const pathname = usePathname();

  // Row navigation uses router.push() (needed for whole-row click), which
  // unlike <Link> doesn't auto-prefetch. Prefetch every visible conversation
  // up front -- lists here are small -- so opening one feels instant instead
  // of waiting on a cold RSC fetch triggered by the click itself.
  useEffect(() => {
    for (const conversation of conversations) {
      router.prefetch(`/conversations/${conversation.id}`);
    }
  }, [conversations, router]);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
        No conversations yet.
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
      {conversations.map((conversation) => {
        const active = pathname === `/conversations/${conversation.id}`;
        const name = conversation.lead?.customer_name || "Unlinked conversation";
        const href = `/conversations/${conversation.id}`;

        return (
          <li key={conversation.id}>
            <div
              role="link"
              tabIndex={0}
              onClick={() => router.push(href)}
              onKeyDown={(e) => {
                if (e.key === "Enter") router.push(href);
              }}
              className={`flex cursor-pointer items-center gap-3 px-4 py-4 transition-colors active:bg-slate-100 ${
                active ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={href}
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-sm font-medium text-slate-900 hover:underline"
                  >
                    {name}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelative(conversation.updated_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[conversation.status] ?? STATUS_DOT.closed}`} />
                  <p className="truncate text-xs text-slate-500">{conversation.lead?.phone || conversation.wa_id}</p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
