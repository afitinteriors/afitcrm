// Foreground notification sounds, synthesised with Web Audio (no asset files
// -- avoids bundling/licensing a sound library just for a handful of short
// beeps). Browsers only allow audio after a user gesture. This never tries
// to get around that: the AudioContext is created/resumed inside a real
// gesture handler (installAudioUnlock's listeners, or a direct call from a
// button's own click handler), and playSound() does nothing (returns false)
// until that has happened. The toast still shows either way.

export type SoundId = "loud-alert" | "classic-chime" | "soft-ping" | "double-beep" | "rising-tone";

export const DEFAULT_SOUND: SoundId = "loud-alert";

type Tone = { freq: number; start: number; duration: number };
type SoundDef = { label: string; peakGain: number; tones: Tone[] };

// All synthesised sine tones. "loud-alert" is deliberately the sharpest/
// loudest of the set (higher gain, punchy repeated beeps) -- staff must not
// miss a new lead or message. The others are quieter alternatives for people
// who find that jarring, not a replacement default.
const SOUNDS: Record<SoundId, SoundDef> = {
  "loud-alert": {
    label: "Loud Alert",
    peakGain: 0.24,
    tones: [
      { freq: 1318.51, start: 0, duration: 0.16 },
      { freq: 1318.51, start: 0.19, duration: 0.16 },
      { freq: 1318.51, start: 0.38, duration: 0.24 },
    ],
  },
  "classic-chime": {
    label: "Classic Chime",
    peakGain: 0.07,
    tones: [
      { freq: 880, start: 0, duration: 0.28 },
      { freq: 1174.66, start: 0.14, duration: 0.28 },
    ],
  },
  "soft-ping": {
    label: "Soft Ping",
    peakGain: 0.06,
    tones: [{ freq: 1046.5, start: 0, duration: 0.32 }],
  },
  "double-beep": {
    label: "Double Beep",
    peakGain: 0.16,
    tones: [
      { freq: 987.77, start: 0, duration: 0.12 },
      { freq: 987.77, start: 0.17, duration: 0.12 },
    ],
  },
  "rising-tone": {
    label: "Rising Tone",
    peakGain: 0.15,
    tones: [
      { freq: 659.25, start: 0, duration: 0.14 },
      { freq: 880, start: 0.13, duration: 0.14 },
      { freq: 1174.66, start: 0.26, duration: 0.22 },
    ],
  },
};

export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];

export function isSoundId(value: unknown): value is SoundId {
  return typeof value === "string" && value in SOUNDS;
}

export function soundLabel(id: SoundId): string {
  return SOUNDS[id].label;
}

let ctx: AudioContext | null = null;

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function contextClass(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as AudioWindow).webkitAudioContext ?? null;
}

// Direct, synchronous unlock attempt -- safe to call from any real click
// handler (e.g. a "Preview" or "Enable notification sound" button), not just
// the passive listeners installAudioUnlock sets up. Returns whether audio is
// usable immediately after the call.
export function unlockAudio(): boolean {
  const Ctor = contextClass();
  if (!Ctor) return false;
  try {
    ctx = ctx ?? new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
  return ctx !== null && ctx.state === "running";
}

export function isAudioUnlocked(): boolean {
  return ctx !== null && ctx.state === "running";
}

// Call once from the client shell. Returns a cleanup function.
export function installAudioUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const events = ["pointerdown", "keydown", "touchstart"] as const;

  const unlock = () => {
    if (unlockAudio()) events.forEach((e) => window.removeEventListener(e, unlock));
  };

  events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
  return () => events.forEach((e) => window.removeEventListener(e, unlock));
}

// Plays the given preset. Returns true only if sound was actually scheduled
// (i.e. the audio context is already unlocked from a prior gesture).
export function playSound(id: SoundId): boolean {
  if (!ctx || ctx.state !== "running") return false;
  const def = SOUNDS[id] ?? SOUNDS[DEFAULT_SOUND];
  try {
    const now = ctx.currentTime;
    def.tones.forEach((tone) => {
      const gain = ctx!.createGain();
      gain.connect(ctx!.destination);
      const t0 = now + tone.start;
      const t1 = t0 + tone.duration;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(def.peakGain, t0 + Math.min(0.02, tone.duration / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);

      const osc = ctx!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = tone.freq;
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t1);
    });
    return true;
  } catch {
    return false;
  }
}
