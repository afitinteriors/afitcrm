// Service worker. Two jobs, both deliberately small:
//  1. Keeps the app installable (install/activate below).
//  2. Shows a notification when a Web Push message arrives and routes the tap
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

self.addEventListener("push", (event) => {
  const data = parsePayload(event);
  const title = typeof data.title === "string" && data.title ? data.title : DEFAULT_TITLE;
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // Same tag replaces instead of stacking a second copy of the same event.
    tag: typeof data.tag === "string" ? data.tag : undefined,
    data: { route: safeRoute(data.route), notificationId: typeof data.notificationId === "string" ? data.notificationId : null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
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
