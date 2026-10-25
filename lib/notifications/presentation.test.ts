import { describe, expect, it } from "vitest";
import {
  MAX_EVENT_AGE_MS,
  SEEN_CAP,
  createSeenStore,
  decidePresentation,
  toLiveNotification,
} from "@/lib/notifications/presentation";

const NOW = Date.parse("2026-09-21T12:00:00Z");
const fresh = new Date(NOW - 2_000).toISOString();

function memoryStorage(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  };
}

describe("decidePresentation", () => {
  it("presents a fresh, first-seen event while the page is visible", () => {
    const seen = createSeenStore();
    expect(decidePresentation({ id: "a", createdAt: fresh }, { seen, visible: true, now: NOW })).toBe("present");
  });

  it("ignores an id that was already handled, so Realtime and the SW message never double-present", () => {
    const seen = createSeenStore();
    seen.add("a");
    expect(decidePresentation({ id: "a", createdAt: fresh }, { seen, visible: true, now: NOW })).toBe("ignore");
  });

  it("only marks (no toast, no sound) when the page is hidden, so returning to the app replays nothing", () => {
    const seen = createSeenStore();
    expect(decidePresentation({ id: "a", createdAt: fresh }, { seen, visible: false, now: NOW })).toBe("mark_only");
  });

  it("does not present a stale event", () => {
    const seen = createSeenStore();
    const stale = new Date(NOW - MAX_EVENT_AGE_MS - 1).toISOString();
    expect(decidePresentation({ id: "a", createdAt: stale }, { seen, visible: true, now: NOW })).toBe("mark_only");
  });

  it("presents when there is no timestamp or it is unparsable (the SW message carries none)", () => {
    const seen = createSeenStore();
    expect(decidePresentation({ id: "a" }, { seen, visible: true, now: NOW })).toBe("present");
    expect(decidePresentation({ id: "b", createdAt: "garbage" }, { seen, visible: true, now: NOW })).toBe("present");
  });
});

describe("createSeenStore", () => {
  it("survives a reload through storage", () => {
    const storage = memoryStorage();
    createSeenStore(storage).add("a");
    expect(createSeenStore(storage).has("a")).toBe(true);
  });

  it("tolerates corrupt or unavailable storage", () => {
    expect(createSeenStore(memoryStorage("{bad")).has("a")).toBe(false);
    expect(createSeenStore(memoryStorage('{"x":1}')).has("a")).toBe(false);
    expect(() => createSeenStore(null).add("a")).not.toThrow();
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const store = createSeenStore(throwing);
    store.add("a");
    expect(store.has("a")).toBe(true);
  });

  it("is capped so it cannot grow without bound", () => {
    const store = createSeenStore();
    for (let i = 0; i < SEEN_CAP + 5; i += 1) store.add(`id-${i}`);
    expect(store.has("id-0")).toBe(false);
    expect(store.has(`id-${SEEN_CAP + 4}`)).toBe(true);
  });

  it("the same event delivered twice produces exactly one presentation", () => {
    const seen = createSeenStore();
    const ctx = { seen, visible: true, now: NOW };
    const results = [1, 2].map(() => {
      const d = decidePresentation({ id: "dup", createdAt: fresh }, ctx);
      if (d !== "ignore") seen.add("dup");
      return d;
    });
    expect(results).toEqual(["present", "ignore"]);
  });
});

describe("toLiveNotification", () => {
  it("maps a Realtime row and keeps only title/body/route", () => {
    const n = toLiveNotification({ id: "n1", title: "T", body: "B", route: "/leads/x", created_at: fresh, user_id: "u", dedupe_key: "k" });
    expect(n).toEqual({ id: "n1", title: "T", body: "B", route: "/leads/x", createdAt: fresh });
  });

  it("maps a service-worker message (notificationId)", () => {
    expect(toLiveNotification({ type: "crm-push", notificationId: "n2", title: "T", body: "", route: "/today" })?.id).toBe("n2");
  });

  it("rejects unusable input and replaces an unsafe route with /today", () => {
    expect(toLiveNotification(null)).toBeNull();
    expect(toLiveNotification({ title: "no id" })).toBeNull();
    for (const route of ["https://evil.example", "//evil.example", "javascript:alert(1)", 5, undefined]) {
      expect(toLiveNotification({ id: "n", route })?.route).toBe("/today");
    }
  });
});
