"use client";

import { useState, useSyncExternalStore } from "react";
import { DEFAULT_SOUND, SOUND_IDS, isAudioUnlocked, playSound, soundLabel, unlockAudio, type SoundId } from "@/lib/notifications/chime";
import { getSoundPreference, setSoundPreference, subscribeSoundPreferenceChange } from "@/lib/notifications/sound-preference";

// Deliberately simple: pick a sound, preview it, done. No on/off toggle (push
// enable/disable already lives in NotificationsControl) and no volume slider
// -- neither was asked for, and a volume control here would just duplicate
// the device's own volume control while giving a false sense of control over
// how loud OS-level notifications play.
export function NotificationSoundControl({ userId }: { userId: string }) {
  // useSyncExternalStore, not useState+useEffect: localStorage doesn't exist
  // during SSR, so reading it in a useState initializer produced a real
  // server/client hydration mismatch, and correcting it via a mount effect
  // hit this project's react-hooks/set-state-in-effect rule (both caught
  // live during verification). The server snapshot below is the same
  // DEFAULT_SOUND the server actually renders; the client snapshot reads the
  // real stored value, and setSoundPreference notifies this store so
  // selecting a sound re-renders immediately.
  const selected = useSyncExternalStore(
    subscribeSoundPreferenceChange,
    () => getSoundPreference(userId),
    () => DEFAULT_SOUND,
  );
  const [justUnlocked, setJustUnlocked] = useState(isAudioUnlocked());

  function handlePreview(id: SoundId) {
    const ok = unlockAudio() && playSound(id);
    if (ok) setJustUnlocked(true);
  }

  function handleSelect(id: SoundId) {
    setSoundPreference(userId, id);
    handlePreview(id);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="sound-heading">
      <h2 id="sound-heading" className="text-sm font-semibold text-foreground">
        Notification sound
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose the sound AFIT CRM plays when a new lead or message arrives while this tab is open.
      </p>

      {!justUnlocked && (
        <p className="mt-2 text-xs text-warning" data-testid="sound-unlock-hint">
          Tap a sound below to enable notification sound for this session.
        </p>
      )}

      <ul className="mt-3 space-y-2" role="radiogroup" aria-label="Notification sound">
        {SOUND_IDS.map((id) => {
          const active = id === selected;
          return (
            <li key={id}>
              <div
                className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  active ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleSelect(id)}
                  className="flex min-h-11 flex-1 items-center gap-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 ${
                      active ? "border-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {soundLabel(id)}
                    {id === "loud-alert" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(default)</span>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePreview(id)}
                  aria-label={`Preview ${soundLabel(id)}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                    />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
