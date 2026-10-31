import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Loads the REAL public/sw.js into a sandbox with a fake service-worker
// global, so the shipped file (not a copy) is what is under test.
type Handler = (event: unknown) => void;

function loadServiceWorker() {
  const handlers: Record<string, Handler> = {};
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  const matchAll = vi.fn().mockResolvedValue([]);
  const self = {
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler;
    },
    registration: { showNotification },
    clients: { matchAll, openWindow, claim: vi.fn() },
    location: { origin: "https://afit.example" },
    skipWaiting: vi.fn(),
  };
  const source = readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
  new Function("self", "URL", source)(self, URL);
  return { handlers, showNotification, openWindow, matchAll };
}

function pushEvent(payload: unknown, raw = false) {
  const waitUntil = vi.fn();
  const data = payload === undefined ? null : { json: () => (raw ? JSON.parse(payload as string) : payload) };
  return { event: { data, waitUntil }, waitUntil };
}

function clickEvent(data: unknown) {
  const waitUntil = vi.fn();
  const close = vi.fn();
  return { event: { notification: { data, close }, waitUntil }, waitUntil, close };
}

describe("public/sw.js -- push", () => {
  let sw: ReturnType<typeof loadServiceWorker>;
  beforeEach(() => {
    sw = loadServiceWorker();
  });

  it("shows a notification from a controlled payload and keeps the route in its data", async () => {
    const { event, waitUntil } = pushEvent({ title: "New lead", body: "Assigned to you", route: "/leads/abc", notificationId: "n-1", tag: "lead-abc" });
    sw.handlers.push(event);
    await waitUntil.mock.calls[0][0];

    expect(sw.showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = sw.showNotification.mock.calls[0];
    expect(title).toBe("New lead");
    expect(options).toMatchObject({ body: "Assigned to you", tag: "lead-abc", data: { route: "/leads/abc", notificationId: "n-1" } });
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("falls back to safe defaults for an empty or malformed payload", async () => {
    for (const { event, waitUntil } of [pushEvent(undefined), pushEvent("{not json", true)]) {
      sw.handlers.push(event);
      await waitUntil.mock.calls[0][0];
    }

    for (const [title, options] of sw.showNotification.mock.calls) {
      expect(title).toBe("AFIT CRM");
      expect(options.data.route).toBe("/today");
    }
    expect(sw.showNotification).toHaveBeenCalledTimes(2);
  });

  it("never carries an external or protocol-relative route", async () => {
    for (const route of ["https://evil.example/x", "//evil.example/x", "javascript:alert(1)", 42]) {
      sw.showNotification.mockClear();
      const { event, waitUntil } = pushEvent({ title: "t", route });
      sw.handlers.push(event);
      await waitUntil.mock.calls[0][0];
      expect(sw.showNotification.mock.calls[0][1].data.route).toBe("/today");
    }
  });

  it("uses the notification id as the tag so a repeat replaces instead of stacking", async () => {
    const { event, waitUntil } = pushEvent({ title: "t", route: "/today", notificationId: "n-9" });
    sw.handlers.push(event);
    await waitUntil.mock.calls[0][0];
    expect(sw.showNotification.mock.calls[0][1].tag).toBe("n-9");
  });

  it("shows NO OS notification when a CRM window is visible and hands the event to the page", async () => {
    const postMessage = vi.fn();
    sw.matchAll.mockResolvedValue([{ url: "https://afit.example/leads", visibilityState: "visible", postMessage }]);
    const { event, waitUntil } = pushEvent({ title: "New lead", body: "b", route: "/leads/abc", notificationId: "n-1" });
    sw.handlers.push(event);
    await waitUntil.mock.calls[0][0];

    expect(sw.showNotification).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ type: "crm-push", notificationId: "n-1", title: "New lead", body: "b", route: "/leads/abc" });
  });

  it("shows the OS notification when the CRM window is hidden (background / locked)", async () => {
    const postMessage = vi.fn();
    sw.matchAll.mockResolvedValue([{ url: "https://afit.example/leads", visibilityState: "hidden", postMessage }]);
    const { event, waitUntil } = pushEvent({ title: "t", route: "/leads/abc", notificationId: "n-2" });
    sw.handlers.push(event);
    await waitUntil.mock.calls[0][0];

    expect(sw.showNotification).toHaveBeenCalledTimes(1);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("ignores visible windows from other origins and still shows the OS notification", async () => {
    sw.matchAll.mockResolvedValue([{ url: "https://other.example/", visibilityState: "visible", postMessage: vi.fn() }]);
    const { event, waitUntil } = pushEvent({ title: "t", route: "/today" });
    sw.handlers.push(event);
    await waitUntil.mock.calls[0][0];
    expect(sw.showNotification).toHaveBeenCalledTimes(1);
  });

  it("falls back to the OS notification if the windows cannot be inspected", async () => {
    sw.matchAll.mockRejectedValue(new Error("boom"));
    const { event, waitUntil } = pushEvent({ title: "t", route: "/today" });
    sw.handlers.push(event);
    await waitUntil.mock.calls[0][0];
    expect(sw.showNotification).toHaveBeenCalledTimes(1);
  });

  it("registers no fetch handler, so it can never cache or intercept requests", () => {
    expect(sw.handlers.fetch).toBeUndefined();
  });
});

describe("public/sw.js -- notificationclick", () => {
  let sw: ReturnType<typeof loadServiceWorker>;
  beforeEach(() => {
    sw = loadServiceWorker();
  });

  it("closes the notification and focuses + navigates an existing CRM window", async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn().mockResolvedValue(undefined);
    sw.matchAll.mockResolvedValue([{ url: "https://afit.example/today", focus, navigate }]);
    const { event, waitUntil, close } = clickEvent({ route: "/leads/abc" });

    sw.handlers.notificationclick(event);
    await waitUntil.mock.calls[0][0];

    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("https://afit.example/leads/abc");
    expect(sw.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window on the target route when no CRM window is open", async () => {
    sw.matchAll.mockResolvedValue([]);
    const { event, waitUntil } = clickEvent({ route: "/follow-ups" });

    sw.handlers.notificationclick(event);
    await waitUntil.mock.calls[0][0];

    expect(sw.openWindow).toHaveBeenCalledWith("https://afit.example/follow-ups");
  });

  it("ignores windows from other origins and refuses to route off-site", async () => {
    sw.matchAll.mockResolvedValue([{ url: "https://other.example/", focus: vi.fn(), navigate: vi.fn() }]);
    const { event, waitUntil } = clickEvent({ route: "//evil.example/steal" });

    sw.handlers.notificationclick(event);
    await waitUntil.mock.calls[0][0];

    expect(sw.openWindow).toHaveBeenCalledWith("https://afit.example/today");
  });

  it("falls back to /today when the notification carries no data", async () => {
    sw.matchAll.mockResolvedValue([]);
    const { event, waitUntil } = clickEvent(undefined);

    sw.handlers.notificationclick(event);
    await waitUntil.mock.calls[0][0];

    expect(sw.openWindow).toHaveBeenCalledWith("https://afit.example/today");
  });
});
