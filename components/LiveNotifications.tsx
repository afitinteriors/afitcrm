"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SOUND, installAudioUnlock, playSound, unlockAudio } from "@/lib/notifications/chime";
import { getSoundPreference } from "@/lib/notifications/sound-preference";
import {
  createSeenStore,
  decidePresentation,
  toLiveNotification,
  type LiveNotification,
  type SeenStore,
} from "@/lib/notifications/presentation";

const TOAST_MS = 8000;
const MAX_TOASTS = 3;

// Foreground presentation of the signed-in user's own notification events.
//
// Two sources feed ONE gate (`handle`): a Realtime INSERT on `notifications`
// (RLS scopes it to the caller's own rows) and a message from the service
// worker, which forwards a push here instead of showing an OS banner whenever a
// CRM window is visible. Whichever arrives first presents; the other is
// ignored by notification id, so one event is never shown or chimed twice.
// Nothing here reads history: opening or returning to the app presents nothing.
export function LiveNotifications() {
  const router = useRouter();
  const channelId = useId();
  const seen = useRef<SeenStore | null>(null);
  const timers = useRef(new Map<string, number>());
  const userId = useRef<string | null>(null);
  const [toasts, setToasts] = useState<LiveNotification[]>([]);
  // True once a real notification tried to play its chime and couldn't
  // (audio not yet unlocked by any gesture) -- shows an explicit action
  // instead of failing silently, per this project's autoplay rule.
  const [soundBlocked, setSoundBlocked] = useState(false);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const handle = useCallback(
    (input: unknown) => {
      const n = toLiveNotification(input);
      if (!n) return;
      if (!seen.current) {
        let storage: Storage | null = null;
        try {
          storage = window.sessionStorage;
        } catch {
          storage = null;
        }
        seen.current = createSeenStore(storage);
      }
      const decision = decidePresentation(n, {
        seen: seen.current,
        visible: document.visibilityState === "visible",
        now: Date.now(),
      });
      if (decision === "ignore") return;
      seen.current.add(n.id);
      if (decision === "mark_only") return;

      setToasts((current) => [n, ...current.filter((t) => t.id !== n.id)].slice(0, MAX_TOASTS));
      timers.current.set(n.id, window.setTimeout(() => dismiss(n.id), TOAST_MS));
      const soundId = userId.current ? getSoundPreference(userId.current) : DEFAULT_SOUND;
      if (!playSound(soundId)) setSoundBlocked(true);
    },
    [dismiss],
  );

  useEffect(() => installAudioUnlock(), []);

  // Service worker -> page: a push arrived while this window is visible.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "crm-push") handle(event.data);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [handle]);

  // Realtime: the caller's own new notification rows. RLS
  // (notifications_select_own) is the authorization; no client-side scoping.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // Without this the Realtime join carries no user JWT and RLS silently
      // drops every event (same fix as the conversations subscription).
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      userId.current = session?.user?.id ?? null;
      if (cancelled) return;

      channel = supabase
        .channel(`live-notifications-${channelId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
          handle(payload.new);
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [channelId, handle]);

  useEffect(() => {
    const active = timers.current;
    return () => active.forEach((timer) => window.clearTimeout(timer));
  }, []);

  if (toasts.length === 0 && !soundBlocked) return null;

  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end"
    >
      {soundBlocked && (
        <div
          data-testid="sound-blocked-banner"
          className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg"
        >
          <span className="flex-1 text-xs text-muted-foreground">A notification arrived, but sound is not enabled yet.</span>
          <button
            type="button"
            onClick={() => {
              if (unlockAudio()) setSoundBlocked(false);
            }}
            className="min-h-11 shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Enable notification sound
          </button>
        </div>
      )}
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="live-notification"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl border border-l-4 border-border border-l-primary bg-card p-3 shadow-lg"
        >
          <button
            type="button"
            onClick={() => {
              dismiss(t.id);
              router.push(t.route);
            }}
            className="min-h-11 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block text-sm font-semibold text-foreground">{t.title}</span>
            {t.body && <span className="mt-0.5 block text-xs text-muted-foreground">{t.body}</span>}
          </button>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      ))}
    </div>
  );
}
