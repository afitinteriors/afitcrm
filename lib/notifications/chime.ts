// Foreground notification sounds, synthesised with Web Audio (no asset files
// -- avoids bundling/licensing a sound library for a handful of short musical
// motifs, and sidesteps ever needing to source/clear third-party audio).
// Browsers only allow audio after a user gesture. This never tries to get
// around that: the AudioContext is created/resumed inside a real gesture
// handler (installAudioUnlock's listeners, or a direct call from a button's
// own click handler), and playSound() does nothing (returns false) until
// that has happened. The toast still shows either way.
//
// Sound design: each preset is a short musical motif (2-4 notes), not a
// single beep. Every note is a fundamental sine plus a quieter octave
// overtone (the same trick real bell/chime samples use for a "warm" rather
// than "harsh sine" character), shaped with a fast attack + natural
// exponential decay (no clicky on/off). All notes for a play-through share
// one lowpass filter (tames harsh highs) feeding one DynamicsCompressorNode
// (keeps the result loud and consistent without digital clipping) before
// hitting the destination.

export type SoundId = "loud-alert" | "classic-chime" | "soft-ping" | "double-beep" | "rising-tone";

export const DEFAULT_SOUND: SoundId = "loud-alert";

type Note = {
  freq: number;
  start: number;
  duration: number;
  gain: number;
  // Relative level of a quiet octave-up overtone layered under the
  // fundamental -- gives the tone a bell-like shimmer instead of a flat,
  // crude sine beep. 0 disables it for that note.
  overtone: number;
};

type SoundDef = {
  label: string;
  // Overall level fed into the shared compressor -- kept here rather than
  // baked into every note's gain so each preset's relative loudness is one
  // number to tune.
  masterGain: number;
  // Shared lowpass cutoff for this preset: lower = warmer/softer,
  // higher = brighter/more cut-through. Keeps every tone free of the
  // painfully sharp high-frequency content raw sine oscillators can produce.
  filterHz: number;
  attack: number;
  notes: Note[];
};

function note(freq: number, start: number, duration: number, gain = 1, overtone = 0.32): Note {
  return { freq, start, duration, gain, overtone };
}

// Equal-temperament note frequencies used below, named for readability.
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;

// "loud-alert" is deliberately the brightest, punchiest and loudest of the
// set -- staff must not miss a new lead or message -- but it is a real
// 3-note motif (strong opening note + a quick resolving flourish), not a
// repeated alarm beep. The other four are genuinely different musical
// characters (warm chime, soft bell, related-tone double knock, rising
// motif), not just the same tone at different pitches.
const SOUNDS: Record<SoundId, SoundDef> = {
  "loud-alert": {
    label: "Loud Alert",
    masterGain: 0.55,
    filterHz: 8000,
    attack: 0.006,
    notes: [
      note(G5, 0, 0.16, 1.0, 0.4),
      note(C6, 0.1, 0.18, 1.0, 0.4),
      note(E6, 0.24, 0.46, 0.85, 0.32),
    ],
  },
  "classic-chime": {
    label: "Classic Chime",
    masterGain: 0.4,
    filterHz: 6200,
    attack: 0.01,
    notes: [note(G5, 0, 0.42, 0.9, 0.3), note(C6, 0.2, 0.58, 0.85, 0.3)],
  },
  "soft-ping": {
    label: "Soft Ping",
    masterGain: 0.3,
    filterHz: 5000,
    attack: 0.014,
    notes: [note(A5, 0, 0.38, 0.7, 0.4), note(E6, 0.22, 0.56, 0.55, 0.35)],
  },
  "double-beep": {
    label: "Double Beep",
    masterGain: 0.42,
    filterHz: 6800,
    attack: 0.008,
    notes: [note(E5, 0, 0.15, 0.85, 0.3), note(A5, 0.2, 0.3, 0.95, 0.3)],
  },
  "rising-tone": {
    label: "Rising Tone",
    masterGain: 0.4,
    filterHz: 6800,
    attack: 0.009,
    notes: [note(C5, 0, 0.16, 0.75, 0.28), note(E5, 0.14, 0.17, 0.82, 0.3), note(G6, 0.28, 0.4, 0.9, 0.34)],
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

// One note = a fundamental oscillator plus a quieter octave-up overtone,
// both driven by the same gain envelope (fast attack, exponential decay to
// silence a little past the note's nominal duration for a natural, non-
// clicky tail) -- feeds into the caller's shared filter/compressor bus.
function scheduleNote(audio: AudioContext, bus: AudioNode, base: number, def: SoundDef, n: Note): void {
  const t0 = base + n.start;
  const t1 = t0 + n.duration;
  const peak = def.masterGain * n.gain;

  const envelope = audio.createGain();
  envelope.gain.setValueAtTime(0.0001, t0);
  envelope.gain.exponentialRampToValueAtTime(peak, t0 + def.attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t1);
  envelope.connect(bus);

  const fundamental = audio.createOscillator();
  fundamental.type = "sine";
  fundamental.frequency.value = n.freq;
  fundamental.connect(envelope);
  fundamental.start(t0);
  fundamental.stop(t1 + 0.02);

  if (n.overtone > 0) {
    const overtoneGain = audio.createGain();
    overtoneGain.gain.value = n.overtone;
    overtoneGain.connect(envelope);

    const overtone = audio.createOscillator();
    overtone.type = "sine";
    overtone.frequency.value = n.freq * 2;
    overtone.connect(overtoneGain);
    overtone.start(t0);
    overtone.stop(t1 + 0.02);
  }
}

// Plays the given preset. Returns true only if sound was actually scheduled
// (i.e. the audio context is already unlocked from a prior gesture).
export function playSound(id: SoundId): boolean {
  if (!ctx || ctx.state !== "running") return false;
  const def = SOUNDS[id] ?? SOUNDS[DEFAULT_SOUND];
  try {
    const audio = ctx;
    const now = audio.currentTime;

    // Shared per-play-through bus: a gentle lowpass (keeps every tone free
    // of harsh/painful high-frequency content) into a compressor (lets
    // "Loud Alert" run hot without ever clipping, and keeps all five
    // presets at a consistent, predictable loudness).
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = def.filterHz;
    filter.Q.value = 0.6;

    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;

    filter.connect(compressor);
    compressor.connect(audio.destination);

    def.notes.forEach((n) => scheduleNote(audio, filter, now, def, n));
    return true;
  } catch {
    return false;
  }
}
