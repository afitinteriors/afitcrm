"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/conversations/MessageBubble";
import type { MessageListItem } from "@/lib/conversations";
import type { MessageUpdateSource } from "@/lib/realtime/conversations";

const NEAR_BOTTOM_PX = 120;

// /conversations' own flat-list rendering (no day separators/grouping --
// that's /chat's MessageThread look, kept separate deliberately per §34:
// don't harmonize the two surfaces' visual language). Scroll rule is
// identical to MessageThread's: "initial" (own send / fresh open) always
// jumps to latest; "realtime" only follows if already near the bottom.
export function LiveMessageList({
  messages,
  lastUpdateSource,
}: {
  messages: MessageListItem[];
  lastUpdateSource: MessageUpdateSource;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;
    const container = bottom.closest<HTMLElement>("[data-scroll-container]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";

    if (lastUpdateSource === "initial" || !container) {
      bottom.scrollIntoView({ block: "end", behavior: lastUpdateSource === "initial" ? "auto" : behavior });
      return;
    }

    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottom) bottom.scrollIntoView({ block: "end", behavior });
  }, [messages.length, lastUpdateSource]);

  if (messages.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No messages in this conversation yet.</p>;
  }

  return (
    <div className="space-y-3" aria-live="polite" aria-relevant="additions">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
