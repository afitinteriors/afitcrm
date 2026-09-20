// The only data that ever travels inside a push message. It passes through
// Google/Apple/Mozilla push services, so it is deliberately minimal: no
// phone numbers, message text, customer details or credentials -- callers
// must put a short human label in title/body and an internal route the user
// can tap to see the real detail inside the (authenticated) CRM.

export type PushPayload = {
  title: string;
  body: string;
  type: string;
  route: string;
  notificationId?: string;
};

const MAX_TITLE = 100;
const MAX_BODY = 300;
const MAX_ROUTE = 200;
const TYPE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,49}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same-origin, path-only. "//host", backslashes, control characters and
// anything with a scheme are rejected -- the service worker enforces the same
// rule again on click, this is the server-side half.
export function isInternalRoute(route: unknown): route is string {
  return (
    typeof route === "string" &&
    route.length > 0 &&
    route.length <= MAX_ROUTE &&
    route.startsWith("/") &&
    !route.startsWith("//") &&
    !/[\\\u0000-\u001f\u007f]/.test(route)
  );
}

export function validatePushPayload(input: unknown): PushPayload | null {
  if (!input || typeof input !== "object") return null;
  const { title, body, type, route, notificationId } = input as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length === 0 || title.length > MAX_TITLE) return null;
  if (typeof body !== "string" || body.length > MAX_BODY) return null;
  if (typeof type !== "string" || !TYPE_PATTERN.test(type)) return null;
  if (!isInternalRoute(route)) return null;
  if (notificationId !== undefined && (typeof notificationId !== "string" || !UUID_PATTERN.test(notificationId))) return null;

  return { title: title.trim(), body, type, route, ...(notificationId ? { notificationId } : {}) };
}
