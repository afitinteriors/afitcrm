import { describe, expect, it } from "vitest";
import { getSoundPreference, setSoundPreference } from "@/lib/notifications/sound-preference";
import { DEFAULT_SOUND } from "@/lib/notifications/chime";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("getSoundPreference / setSoundPreference", () => {
  it("returns the default sound when nothing has been set", () => {
    expect(getSoundPreference("user-a", memoryStorage())).toBe(DEFAULT_SOUND);
  });

  it("returns the default sound when storage is unavailable (null)", () => {
    expect(getSoundPreference("user-a", null)).toBe(DEFAULT_SOUND);
  });

  it("persists a real selection for that user", () => {
    const storage = memoryStorage();
    setSoundPreference("user-a", "soft-ping", storage);
    expect(getSoundPreference("user-a", storage)).toBe("soft-ping");
  });

  it("ignores a corrupted/unknown stored value and falls back to the default", () => {
    const storage = memoryStorage();
    storage.setItem("afit.notificationSound.user-a", "not-a-real-sound");
    expect(getSoundPreference("user-a", storage)).toBe(DEFAULT_SOUND);
  });

  it("keeps two users' preferences completely independent on the same storage", () => {
    const storage = memoryStorage();
    setSoundPreference("staff-a", "rising-tone", storage);
    setSoundPreference("staff-b", "double-beep", storage);

    expect(getSoundPreference("staff-a", storage)).toBe("rising-tone");
    expect(getSoundPreference("staff-b", storage)).toBe("double-beep");

    // Changing Staff A's sound again must never move Staff B's.
    setSoundPreference("staff-a", "classic-chime", storage);
    expect(getSoundPreference("staff-a", storage)).toBe("classic-chime");
    expect(getSoundPreference("staff-b", storage)).toBe("double-beep");
  });

  it("never throws when storage.setItem throws (private mode / quota)", () => {
    const throwing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    };
    expect(() => setSoundPreference("user-a", "loud-alert", throwing)).not.toThrow();
  });
});
