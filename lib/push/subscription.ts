// Shape validation for a browser PushSubscription (subscription.toJSON()).
// Pure and dependency-free so it runs identically in tests, server actions
// and (if ever needed) the client. The endpoint and keys are treated as
// secrets: this module never logs them and its errors never echo them.

export type ValidPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

const MAX_ENDPOINT_LENGTH = 2048;
const MAX_KEY_LENGTH = 256;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export function parsePushSubscription(input: unknown): ValidPushSubscription | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };

  const { endpoint } = raw;
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > MAX_ENDPOINT_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  // Web Push endpoints are always https (browsers refuse to issue any other).
  if (url.protocol !== "https:") return null;

  const p256dh = raw.keys?.p256dh;
  const auth = raw.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  for (const key of [p256dh, auth]) {
    if (key.length === 0 || key.length > MAX_KEY_LENGTH || !BASE64URL.test(key)) return null;
  }

  return { endpoint, p256dh, auth };
}

export function cleanUserAgent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 300);
  return trimmed || null;
}
