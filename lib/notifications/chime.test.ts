import { describe, expect, it } from "vitest";
import { DEFAULT_SOUND, SOUND_IDS, isSoundId, soundLabel } from "@/lib/notifications/chime";

// playSound/unlockAudio/installAudioUnlock need a real (or mocked) Web Audio
// AudioContext and are exercised live in the browser (see afit-verify), not
// here -- this file only covers the pure preset metadata.
describe("sound presets", () => {
  it("lists at least the loud default plus real alternatives", () => {
    expect(SOUND_IDS.length).toBeGreaterThanOrEqual(3);
    expect(SOUND_IDS).toContain(DEFAULT_SOUND);
  });

  it("gives every preset a non-empty, distinct label", () => {
    const labels = SOUND_IDS.map(soundLabel);
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("recognises only real preset ids", () => {
    SOUND_IDS.forEach((id) => expect(isSoundId(id)).toBe(true));
    expect(isSoundId("not-a-real-sound")).toBe(false);
    expect(isSoundId(null)).toBe(false);
    expect(isSoundId(undefined)).toBe(false);
    expect(isSoundId(42)).toBe(false);
  });

  it("defaults to the loud alert, not a quiet one", () => {
    expect(DEFAULT_SOUND).toBe("loud-alert");
  });
});
