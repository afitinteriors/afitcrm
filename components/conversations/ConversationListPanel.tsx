"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { formatRelative } from "@/lib/format";
import type { ConversationListItem } from "@/lib/conversations";
import { useLiveConversationList } from "@/lib/realtime/conversations";
import { ConnectionIndicator } from "@/components/conversations/ConnectionIndicator";

const STATUS_DOT: Record<string, string> = {
  open: "bg-emerald-500",
  closed: "bg-muted-foreground",
};

// basePath lets this list be reused by both the CRM's embedded /conversations
// view and the standalone /chat surface -- same data, same component,
// different destination route. Defaults to the existing CRM route so the
// current caller needs no change.
export function ConversationListPanel({
  conversations: initialConversations,
  basePath = "/conversations",
}: {
  conversations: ConversationListItem[];
  basePath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const activeId = pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length + 1) : null;
  const { conversations, cuedIds, connectionState } = useLiveConversationList(initialConversations, activeId);

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
      <ConnectionIndicator state={connectionState} />
      <div className="shrink-0 border-b border-border p-2.5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          aria-label="Search conversations"
          className="block w-full rounded-full border border-border bg-secondary px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          No conversations yet.
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          No conversations match &quot;{search}&quot;.
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
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
                  className={`flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors active:bg-secondary ${
                    active ? "bg-[#eef4f1]" : "hover:bg-secondary"
                  }`}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#14342a] text-base font-semibold text-white">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {!active && cuedIds.has(conversation.id) && (
                          <span
                            aria-label="New activity"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                          />
                        )}
                        <Link
                          href={href}
                          onClick={(e) => e.stopPropagation()}
                          className="truncate text-sm font-medium text-foreground"
                        >
                          {name}
                        </Link>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(conversation.updated_at)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[conversation.status] ?? STATUS_DOT.closed}`} />
                      <p className="truncate text-xs text-muted-foreground">{conversation.lead?.phone || conversation.wa_id}</p>
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
