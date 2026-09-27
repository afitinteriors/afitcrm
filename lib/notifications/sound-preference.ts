// Per-user notification sound choice. Deliberately client-storage only, not
// a new Supabase column/table: this is a per-device UI preference, not
// shared CRM data, and .claude/rules/database.md rules out new schema for
// anything a UI-level mechanism can already cover. Keyed by the signed-in
// user's own id (not just origin-wide) so a shared/kiosk device can never
// leak one person's chime choice into another's session, and so Staff A
// changing their sound can never affect Staff B.
//
// Trade-off, stated plainly: this does not sync across a user's own devices
// (a phone and a laptop can end up with different sounds). Syncing that
// would need a real per-user settings table -- a schema change, out of
// scope here without separate approval.
import { DEFAULT_SOUND, isSoundId, type SoundId } from "@/lib/notifications/chime";

const STORAGE_PREFIX = "afit.notificationSound.";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

// Same injectable-storage shape as createSeenStore (lib/notifications/
// presentation.ts) -- defaults to the real localStorage in the browser, but
// lets tests pass an in-memory stand-in instead of needing a DOM.
function defaultStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getSoundPreference(userId: string, storage: StorageLike | null = defaultStorage()): SoundId {
  try {
    const raw = storage?.getItem(STORAGE_PREFIX + userId);
    return isSoundId(raw) ? raw : DEFAULT_SOUND;
  } catch {
    return DEFAULT_SOUND;
  }
}

export function setSoundPreference(userId: string, soundId: SoundId, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(STORAGE_PREFIX + userId, soundId);
  } catch {
    // Storage unavailable (private mode / quota) -- the in-memory selection
    // in the settings UI still works for the rest of this session.
  }
  notifyChange();
}

// Minimal external-store plumbing so the settings UI can use
// useSyncExternalStore (components/NotificationSoundControl.tsx) instead of
// reading localStorage inside a useState initializer or a mount effect --
// both cause either a real server/client hydration mismatch (localStorage
// doesn't exist during SSR) or a disallowed setState-in-effect. This is the
// React-sanctioned way to read a client-only source safely under SSR.
const listeners = new Set<() => void>();

function notifyChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeSoundPreferenceChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
