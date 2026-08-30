"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/conversations/MessageBubble";
import type { MessageListItem } from "@/lib/conversations";
import type { MessageUpdateSource } from "@/lib/realtime/conversations";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;

// §34: an own-send/fresh-open ("initial") always jumps to the latest
// message; a Realtime-delivered message ("realtime") only follows if the
// viewer is already near the bottom -- never yanks them away from history
// they're reading. The scrollable ancestor is marked with
// data-scroll-container by the page (this component isn't the scroll
// container itself), so it's located via `closest` rather than assumed to
// be a fixed number of DOM levels up.
function scrollToLatest(bottom: HTMLDivElement, source: MessageUpdateSource) {
  const container = bottom.closest<HTMLElement>("[data-scroll-container]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";

  if (source === "initial" || !container) {
    bottom.scrollIntoView({ block: "end", behavior: source === "initial" ? "auto" : behavior });
    return;
  }

  const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX;
  if (nearBottom) bottom.scrollIntoView({ block: "end", behavior });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

// List-level concerns (day separators, consecutive-message grouping) live
// here rather than in MessageBubble -- a single bubble has no way to know
// about the message before it. MessageBubble itself is unchanged in
// contract; this only decides spacing and whether to insert a separator.
export function MessageThread({
  messages,
  lastUpdateSource = "initial",
}: {
  messages: MessageListItem[];
  lastUpdateSource?: MessageUpdateSource;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) scrollToLatest(bottomRef.current, lastUpdateSource);
  }, [messages.length, lastUpdateSource]);

  if (messages.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No messages in this conversation yet.</p>;
  }

  const items: React.ReactNode[] = [];
  let previous: MessageListItem | null = null;

  for (const message of messages) {
    const created = new Date(message.created_at);
    const showDaySeparator = !previous || !isSameDay(created, new Date(previous.created_at));

    const grouped =
      !showDaySeparator &&
      previous !== null &&
      previous.direction === message.direction &&
      created.getTime() - new Date(previous.created_at).getTime() < GROUP_WINDOW_MS;

    if (showDaySeparator) {
      items.push(
        <div key={`sep-${message.id}`} className="flex justify-center py-2">
          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
            {dayLabel(created)}
          </span>
        </div>
      );
    }

    items.push(
      <div key={message.id} className={grouped ? "mt-0.5" : "mt-3"}>
        <MessageBubble message={message} />
      </div>
    );

    previous = message;
  }

  return (
    <div className="space-y-0" aria-live="polite" aria-relevant="additions">
      {items}
      <div ref={bottomRef} />
    </div>
  );
}
