"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { formatRelative } from "@/lib/format";
import type { ConversationListItem } from "@/lib/conversations";

const STATUS_DOT: Record<string, string> = {
  open: "bg-emerald-500",
  closed: "bg-slate-300",
};

// basePath lets this list be reused by both the CRM's embedded /conversations
// view and the standalone /chat surface -- same data, same component,
// different destination route. Defaults to the existing CRM route so the
// current caller needs no change.
export function ConversationListPanel({
  conversations,
  basePath = "/conversations",
}: {
  conversations: ConversationListItem[];
  basePath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  useEffect(() => {
    for (const conversation of conversations) {
      router.prefetch(`${basePath}/${conversation.id}`);
    }
  }, [conversations, router, basePath]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((c) => {
      const name = c.lead?.customer_name?.toLowerCase() ?? "";
      const phone = (c.lead?.phone ?? c.wa_id).toLowerCase();
      return name.includes(term) || phone.includes(term);
    });
  }, [conversations, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-100 p-2.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search conversations"
          className="block w-full rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
        />
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
          No conversations yet.
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">
          No conversations match &quot;{search}&quot;.
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
          {visible.map((conversation) => {
            const active = pathname === `${basePath}/${conversation.id}`;
            const name = conversation.lead?.customer_name || "Unlinked conversation";
            const href = `${basePath}/${conversation.id}`;

            return (
              <li key={conversation.id}>
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(href);
                  }}
                  className={`flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors active:bg-slate-100 ${
                    active ? "bg-[#eef4f1]" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#14342a] text-base font-semibold text-white">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate text-sm font-medium text-slate-900"
                      >
                        {name}
                      </Link>
                      <span className="shrink-0 text-[11px] text-slate-500">{formatRelative(conversation.updated_at)}</span>
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
      )}
    </div>
  );
}
