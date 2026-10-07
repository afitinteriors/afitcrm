"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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

const noopSubscribe = () => () => {};

// formatRelative() depends on Date.now(), which is evaluated at a different
// wall-clock instant during SSR than during the client's initial hydration
// render -- the classic cause of a text-content hydration mismatch (React
// error #418) for any relative-time label rendered directly during render.
// Same fix, same useSyncExternalStore idiom, as components/NotificationSoundControl.tsx
// and components/automation-hub/UpdatedAt.tsx already established for this
// project: a neutral placeholder on the server and first paint (both sides
// render the same thing, so hydration has nothing to mismatch), the real
// value once mounted. useState+useEffect was tried first and rejected --
// setState directly in an effect body trips this project's
// react-hooks/set-state-in-effect lint rule, same as those two files note.
function RelativeTime({ value }: { value: string | null | undefined }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return <>{isClient ? formatRelative(value) : ""}</>;
}

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
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        <RelativeTime value={conversation.updated_at} />
                      </span>
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
