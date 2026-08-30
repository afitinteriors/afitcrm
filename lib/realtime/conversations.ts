"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ConversationRow, MessageRow } from "@/lib/supabase/types";
import type { ConversationListItem, MessageListItem } from "@/lib/conversations";

// Shared Realtime foundation for both /conversations and /chat (Phase 4b.2,
// CLAUDE.md §32/§34). Deliberately the only subscription mechanism in the
// app -- do not add a second, page-specific implementation.
//
// Security: authorization is enforced entirely by the existing Postgres RLS
// policies (`conversations_select_admin_or_owner`, `messages_select_admin_or
// _owner`) -- Supabase Realtime re-evaluates these same policies per event
// using the subscriber's own JWT (verified against Supabase's current docs
// and this project's live policy definitions before writing this file).
// That's why every subscription below uses the browser/anon client from
// `lib/supabase/client.ts`, never a service-role client, and why the list
// subscription applies no client-side scoping of its own -- a client-side
// filter is not a substitute for authorization, RLS is. The one filter used
// (`conversation_id=eq.<id>` on the thread subscription) is a traffic
// optimization only; an unauthorized id still yields nothing, because RLS
// still applies underneath it.

export type RealtimeConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected";

function mapStatus(status: string, attempt: { current: number }): RealtimeConnectionState {
  if (status === "SUBSCRIBED") {
    attempt.current = 0;
    return "connected";
  }
  if (status === "CLOSED") return "disconnected";
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
    attempt.current += 1;
    // First drop reads as a transient reconnect; a repeat failure on the
    // same mount is treated as a real disconnect. Phase 4b.3 owns how this
    // is actually displayed -- this hook only classifies the raw status.
    return attempt.current > 1 ? "disconnected" : "reconnecting";
  }
  return "connecting";
}

/**
 * List-level subscription: any `conversations` insert/update this client's
 * RLS allows it to see. No table-side filter -- see the module note above.
 * Consumed by the list column/screen on both /conversations and /chat.
 * Phase 4b.3 decides what to do with each event (reorder, cue); this hook
 * only delivers the row and the connection state.
 */
export function useConversationListRealtime(onChange: (row: ConversationRow) => void): RealtimeConnectionState {
  const [state, setState] = useState<RealtimeConnectionState>("connecting");
  const attempt = useRef(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // `createClient()` returns a memoized singleton browser client, so its
  // realtime channel registry is shared across every mount -- a channel
  // name reused across two overlapping mounts (React's dev-mode double-
  // effect-invocation, or a fast unmount/remount) can resolve to a channel
  // that's already `subscribed`, and calling `.on()` on it again throws.
  // A per-instance id keeps every mount's channel name unique.
  const instanceId = useId();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // The join payload only carries `access_token` if `socket.accessTokenValue`
    // is already populated at the moment `.subscribe()` runs (realtime-js reads
    // it synchronously, it does not await pending auth) -- so the session's JWT
    // must be pushed onto the realtime client before subscribing, not left to
    // the client's own auth-state listener, or every event is silently
    // evaluated as `anon` and dropped by the `TO authenticated` RLS policies.
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`conversations-list-${instanceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations" },
          (payload) => onChangeRef.current(payload.new as ConversationRow)
        )
        .subscribe((status) => setState(mapStatus(status, attempt)));
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [instanceId]);

  return state;
}

/**
 * Thread-level subscription: new messages for one open conversation.
 * Consumed by the open thread on both /conversations and /chat. Filtered
 * by `conversation_id` purely to cut traffic -- RLS on `messages` is the
 * real boundary regardless of this filter.
 */
export function useMessageRealtime(
  conversationId: string,
  onMessage: (message: MessageRow) => void
): RealtimeConnectionState {
  const [state, setState] = useState<RealtimeConnectionState>("connecting");
  const attempt = useRef(0);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });
  // See the matching note in useConversationListRealtime above.
  const instanceId = useId();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // See the matching note in useConversationListRealtime above.
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;

      channel = supabase
        .channel(`messages-${conversationId}-${instanceId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => onMessageRef.current(payload.new as MessageRow)
        )
        .subscribe((status) => setState(mapStatus(status, attempt)));
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, instanceId]);

  return state;
}

// --- Phase 4b.3: presentation-ready state built on the two primitives ------
// above. Still exactly one subscription per concern -- these are the only
// consumers of useConversationListRealtime/useMessageRealtime in the app.

export type MessageUpdateSource = "initial" | "realtime";

/**
 * One conversation's live message list. `initialMessages` is the
 * server-fetched page load (or the fresh list after this client's own send
 * re-validates) -- every change to that array resets local state to match
 * it and is treated as "initial" (always scroll to bottom: that's either a
 * fresh open of the thread or the user's own send confirming). A message
 * arriving via Realtime is "realtime" (conditional scroll only). Dedupe is
 * by `id` -- a message this client just sent will re-arrive over Realtime
 * and is dropped, never rendered twice.
 */
export function useLiveMessages(conversationId: string, initialMessages: MessageListItem[]) {
  // "Adjusting state when a prop changes" (react.dev) -- a conditional
  // setState call during render, not inside an effect, so a fresh
  // initialMessages array (new conversation, or the revalidation after this
  // client's own send) resets local state in the same render instead of
  // flashing stale content for one extra frame.
  const [snapshot, setSnapshot] = useState({ conversationId, initialMessages });
  const [messages, setMessages] = useState(initialMessages);
  const [lastUpdateSource, setLastUpdateSource] = useState<MessageUpdateSource>("initial");

  if (snapshot.conversationId !== conversationId || snapshot.initialMessages !== initialMessages) {
    setSnapshot({ conversationId, initialMessages });
    setMessages(initialMessages);
    setLastUpdateSource("initial");
  }

  const connectionState = useMessageRealtime(conversationId, (message) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    setLastUpdateSource("realtime");
  });

  return { messages, lastUpdateSource, connectionState };
}

/**
 * The live conversation list: reorders on any update to a conversation
 * already in view, and tracks which non-active conversations have an
 * unseen update since mount (the §34 transient cue -- in-memory only,
 * cleared the moment `activeId` matches, never persisted). A `conversations`
 * INSERT for an id not already in `initialConversations` is deliberately
 * ignored here -- the Realtime payload for a brand-new row has no joined
 * `lead` data, and synthesizing it is out of scope for this phase (§34 only
 * requires reordering on a new *message* in an existing conversation); a
 * genuinely new conversation still appears on the next navigation/refresh.
 */
export function useLiveConversationList(initialConversations: ConversationListItem[], activeId: string | null) {
  // Same render-time-adjustment pattern as useLiveMessages above.
  const [snapshot, setSnapshot] = useState(initialConversations);
  const [conversations, setConversations] = useState(initialConversations);
  const [cuedIds, setCuedIds] = useState<Set<string>>(() => new Set());

  if (snapshot !== initialConversations) {
    setSnapshot(initialConversations);
    setConversations(initialConversations);
  }

  // Clearing the cue when its conversation becomes active is naturally
  // self-guarding: once `cuedIds` no longer has `activeId`, this condition
  // is false and stops firing on every subsequent render.
  if (activeId && cuedIds.has(activeId)) {
    const next = new Set(cuedIds);
    next.delete(activeId);
    setCuedIds(next);
  }

  // `activeId` here is captured fresh on every render because
  // useConversationListRealtime re-syncs its own internal ref-to-latest-
  // callback in an effect after each render (see onChangeRef above) --
  // no separate ref needed on this side.
  const connectionState = useConversationListRealtime((row) => {
    setConversations((prev) => {
      if (!prev.some((c) => c.id === row.id)) return prev;
      const next = prev.map((c) => (c.id === row.id ? { ...c, ...row } : c));
      next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return next;
    });
    if (row.id !== activeId) {
      setCuedIds((prev) => (prev.has(row.id) ? prev : new Set(prev).add(row.id)));
    }
  });

  return { conversations, cuedIds, connectionState };
}
