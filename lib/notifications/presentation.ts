import { isInternalRoute } from "@/lib/push/payload";

// Pure decision logic for showing a notification while the CRM is open.
// Kept free of React/DOM so the "never replay, never duplicate" rules are
// unit-testable. Only fields that already travel in the push payload appear
// here (title/body/route) -- no phone numbers, message text or customer data.

export type LiveNotification = {
  id: string;
  title: string;
  body: string;
  route: string;
  // When the notifications row was created (ISO). Used only as a safety net.
  createdAt?: string | null;
};

export type Decision = "present" | "mark_only" | "ignore";

// Realtime never replays history, so this is belt-and-braces: an event this
// old is treated as already-handled instead of being presented with a sound.
export const MAX_EVENT_AGE_MS = 120_000;
export const SEEN_CAP = 200;
export const DEFAULT_ROUTE = "/today";

export type SeenStore = { has(id: string): boolean; add(id: string): void };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "afit.seenNotifications";

// Remembers which notification ids were already handled -- in memory, mirrored
// to sessionStorage so a page reload does not present the same event again.
export function createSeenStore(storage?: StorageLike | null): SeenStore {
  let ids: string[] = [];
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === "string").slice(-SEEN_CAP);
  } catch {
    ids = [];
  }
  const set = new Set(ids);

  return {
    has: (id) => set.has(id),
    add: (id) => {
      if (set.has(id)) return;
      set.add(id);
      ids.push(id);
      if (ids.length > SEEN_CAP) {
        const dropped = ids.splice(0, ids.length - SEEN_CAP);
        dropped.forEach((old) => set.delete(old));
      }
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(ids));
      } catch {
        // Storage unavailable (private mode / quota): memory-only is fine.
      }
    },
  };
}

// present   -> toast + one chime (page visible, event fresh, first time seen)
// mark_only -> remember it but show/play nothing (page hidden or event stale),
//              so returning to the app can never replay it
// ignore    -> already handled
export function decidePresentation(
  n: Pick<LiveNotification, "id" | "createdAt">,
  ctx: { seen: SeenStore; visible: boolean; now: number },
): Decision {
  if (ctx.seen.has(n.id)) return "ignore";
  if (!ctx.visible) return "mark_only";
  if (n.createdAt) {
    const created = Date.parse(n.createdAt);
    if (Number.isFinite(created) && ctx.now - created > MAX_EVENT_AGE_MS) return "mark_only";
  }
  return "present";
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

// Normalises a Realtime row or a service-worker message into a
// LiveNotification, re-validating the route with the same rule the server and
// service worker use. Returns null when there is no usable id.
export function toLiveNotification(input: unknown): LiveNotification | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : typeof r.notificationId === "string" ? r.notificationId : null;
  if (!id) return null;
  const title = text(r.title, 100).trim() || "AFIT CRM";
  const createdAt = typeof r.created_at === "string" ? r.created_at : typeof r.createdAt === "string" ? r.createdAt : null;
  return {
    id,
    title,
    body: text(r.body, 300),
    route: isInternalRoute(r.route) ? r.route : DEFAULT_ROUTE,
    createdAt,
  };
}
