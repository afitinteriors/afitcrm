"use client";

// Browser-side Web Push helpers. Nothing here runs automatically: every
// entry point is invoked from an explicit user action (the enable/disable
// buttons, or sign-out). Notification permission is only ever requested
// inside enablePush().

import { subscribePush, unsubscribePush } from "@/lib/actions/push";

export type PushSupport = "supported" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "supported" : "unsupported";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

// serviceWorker.ready never settles if no worker is registered (e.g. the
// dev server, where registration is production-only), so bound the wait.
async function activeRegistration(timeoutMs = 5000): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() === "unsupported") return null;
  const registration = await activeRegistration(1500);
  return registration ? registration.pushManager.getSubscription() : null;
}

export type EnableResult = { ok: true } | { ok: false; reason: "denied" | "no-worker" | "error"; message?: string };

export async function enablePush(publicKey: string): Promise<EnableResult> {
  try {
    // Only reached from a click handler -- this is the one place permission
    // is requested.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const registration = await activeRegistration();
    if (!registration) return { ok: false, reason: "no-worker" };

    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const result = await subscribePush(subscription.toJSON(), navigator.userAgent);
    if ("error" in result) {
      await subscription.unsubscribe().catch(() => {});
      return { ok: false, reason: "error", message: result.error };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export async function disablePush(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return { ok: true };
    const result = await unsubscribePush(subscription.endpoint);
    if ("error" in result) return { ok: false, message: result.error };
    await subscription.unsubscribe().catch(() => {});
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not turn off notifications on this device." };
  }
}

// Called just before sign-out so a shared browser doesn't keep delivering
// the previous user's notifications. Best-effort and time-boxed: it must
// never block or break signing out.
export async function revokeCurrentBrowserPush(): Promise<void> {
  try {
    await Promise.race([disablePush(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch {
    // ignore
  }
}
