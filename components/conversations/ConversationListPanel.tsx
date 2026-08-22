"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatRelative } from "@/lib/format";
import type { ConversationListItem } from "@/lib/conversations";

const STATUS_DOT: Record<string, string> = {
  open: "bg-emerald-500",
  closed: "bg-slate-300",
};

export function ConversationListPanel({ conversations }: { conversations: ConversationListItem[] }) {
  const pathname = usePathname();

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

        return (
          <li key={conversation.id}>
            <Link
              href={`/conversations/${conversation.id}`}
              className={`flex items-center gap-3 px-4 py-4 transition-colors active:bg-slate-100 ${
                active ? "bg-blue-50" : "hover:bg-slate-50"
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-base font-semibold text-slate-600">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelative(conversation.updated_at)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[conversation.status] ?? STATUS_DOT.closed}`} />
                  <p className="truncate text-xs text-slate-500">{conversation.lead?.phone || conversation.wa_id}</p>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
