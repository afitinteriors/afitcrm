// Service worker. Two jobs, both deliberately small:
//  1. Keeps the app installable (install/activate below).
//  2. Shows an OS notification when a Web Push message arrives while no CRM
//     window is visible (otherwise hands it to the page), and routes the tap
//     into the CRM (push / notificationclick).
// It caches nothing and never handles "fetch": every page, API and Supabase
// call goes straight to the network, so no authenticated data is stored here.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const DEFAULT_TITLE = "AFIT CRM";
const DEFAULT_ROUTE = "/today";

// Only same-origin, path-style routes are honoured -- a malformed or hostile
// payload can never send the user to another site.
function safeRoute(route) {
  return typeof route === "string" && route.startsWith("/") && !route.startsWith("//") ? route : DEFAULT_ROUTE;
}

function parsePayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

// A visible CRM window presents the event itself (in-app toast + chime, via
// the page), so no OS banner is shown on top of it. With no visible window --
// backgrounded, minimised or the phone locked -- the OS notification is shown,
// and its sound / lock-screen behaviour is up to the browser and OS.
function isVisibleCrmWindow(client) {
  return new URL(client.url).origin === self.location.origin && client.visibilityState === "visible";
}

self.addEventListener("push", (event) => {
  const data = parsePayload(event);
  const title = typeof data.title === "string" && data.title ? data.title : DEFAULT_TITLE;
  const route = safeRoute(data.route);
  const notificationId = typeof data.notificationId === "string" ? data.notificationId : null;
  const body = typeof data.body === "string" ? data.body : "";
  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Same tag replaces instead of stacking a second copy of the same event.
    tag: typeof data.tag === "string" ? data.tag : notificationId || undefined,
    data: { route, notificationId },
  };
  const show = () => self.registration.showNotification(title, options);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const visible = windows.filter(isVisibleCrmWindow);
        if (visible.length === 0) return show();
        // Only what the push already carried -- title/body/route, no customer data.
        visible.forEach((client) => client.postMessage({ type: "crm-push", notificationId, title, body, route }));
        return undefined;
      })
      // If the windows cannot be inspected, fall back to showing the OS notification.
      .catch(show),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = safeRoute(event.notification.data && event.notification.data.route);
  const target = new URL(route, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        // Focus the open CRM window and steer it to the target route.
        return existing.focus().then(() => ("navigate" in existing ? existing.navigate(target) : undefined));
      }
      return self.clients.openWindow(target);
    }),
  );
});
