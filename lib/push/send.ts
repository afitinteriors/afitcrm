import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVapidConfig } from "@/lib/push/config";
import { validatePushPayload, type PushPayload } from "@/lib/push/payload";

// Server-side Web Push delivery. Phase B: this only *delivers* a push to one
// user's devices. Nothing calls it from a business event yet.
//
// Uses the service-role client because it runs in trusted server code with no
// requirement that the caller be the recipient (later phases notify staff
// about events they did not trigger). Callers are responsible for deciding
// WHO may be notified -- the manual test action only ever passes the
// signed-in user's own id.

export type DeviceOutcome = "sent" | "expired" | "failed";

export type SendPushResult =
  | { status: "invalid_payload" }
  | { status: "vapid_not_configured"; reason: "missing" | "invalid_subject" | "placeholder_subject" }
  | { status: "no_subscriptions" }
  | { status: "duplicate"; notificationId: string }
  | {
      status: "sent" | "partial" | "failed";
      notificationId: string | null;
      sent: number;
      expired: number;
      failed: number;
      // Per-device outcomes reference subscription row ids only -- never the
      // endpoint or keys.
      devices: { subscriptionId: string; outcome: DeviceOutcome; statusCode?: number }[];
    };

export type SendPushOptions = {
  // Idempotency key. Re-sending the same (user, dedupeKey) after it has
  // already been sent returns "duplicate" instead of pushing again. Omit for
  // a send that has no history row.
  dedupeKey?: string;
  // Seconds a push service should hold the message for an offline device.
  // Short by design: a stale "follow-up due" alert hours later is noise.
  ttlSeconds?: number;
  entityType?: string;
  entityId?: string;
};

const DEFAULT_TTL_SECONDS = 3600;
// 404/410 from a push service mean the subscription is permanently gone.
const GONE_STATUS_CODES = new Set([404, 410]);

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

export async function sendPushToUser(userId: string, input: unknown, options: SendPushOptions = {}): Promise<SendPushResult> {
  const payload = validatePushPayload(input);
  if (!payload) return { status: "invalid_payload" };

  const vapid = getVapidConfig();
  if (!vapid.ok) return { status: "vapid_not_configured", reason: vapid.reason };

  const admin = createAdminClient();

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)
    .is("revoked_at", null);
  const active = (subscriptions ?? []) as SubscriptionRow[];
  if (active.length === 0) return { status: "no_subscriptions" };

  // History row (only when the caller supplied a dedupe key).
  let notificationId: string | null = null;
  if (options.dedupeKey) {
    const { data: created, error } = await admin
      .from("notifications")
      .insert({
        user_id: userId,
        type: payload.type,
        entity_type: options.entityType ?? null,
        entity_id: options.entityId ?? null,
        title: payload.title,
        body: payload.body,
        route: payload.route,
        dedupe_key: options.dedupeKey,
      })
      .select("id")
      .single();

    if (created) {
      notificationId = created.id;
    } else if (error?.code === "23505") {
      const { data: existing } = await admin
        .from("notifications")
        .select("id, sent_at")
        .eq("user_id", userId)
        .eq("dedupe_key", options.dedupeKey)
        .single();
      if (existing?.sent_at) return { status: "duplicate", notificationId: existing.id };
      notificationId = existing?.id ?? null;
    }
    // Any other history error is non-fatal: the push itself is still worth sending.
  }

  const message: PushPayload = { ...payload, ...(notificationId ? { notificationId } : {}) };
  const body = JSON.stringify(message);

  // Every device is attempted independently; one failure never blocks another.
  const settled = await Promise.allSettled(
    active.map((sub) =>
      webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
        TTL: options.ttlSeconds ?? DEFAULT_TTL_SECONDS,
        vapidDetails: { subject: vapid.config.subject, publicKey: vapid.config.publicKey, privateKey: vapid.config.privateKey },
      }),
    ),
  );

  const devices: { subscriptionId: string; outcome: DeviceOutcome; statusCode?: number }[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < active.length; i += 1) {
    const sub = active[i];
    const result = settled[i];

    if (result.status === "fulfilled") {
      await admin.from("push_subscriptions").update({ last_success_at: now }).eq("id", sub.id);
      devices.push({ subscriptionId: sub.id, outcome: "sent" });
      continue;
    }

    const statusCode = (result.reason as { statusCode?: unknown } | null)?.statusCode;
    const code = typeof statusCode === "number" ? statusCode : undefined;

    if (code !== undefined && GONE_STATUS_CODES.has(code)) {
      // Permanently invalid: revoke so it is never retried.
      await admin.from("push_subscriptions").update({ revoked_at: now }).eq("id", sub.id);
      devices.push({ subscriptionId: sub.id, outcome: "expired", statusCode: code });
    } else {
      // Transient (5xx, 429, network): keep the subscription. Log status
      // only -- never the endpoint, keys or the push service's response body.
      console.error(`[push] transient send failure sub=${sub.id} status=${code ?? "network"}`);
      devices.push({ subscriptionId: sub.id, outcome: "failed", ...(code !== undefined ? { statusCode: code } : {}) });
    }
  }

  const sent = devices.filter((d) => d.outcome === "sent").length;
  const expired = devices.filter((d) => d.outcome === "expired").length;
  const failed = devices.filter((d) => d.outcome === "failed").length;

  // sent_at = the push service accepted the message from the server. It is
  // NOT delivery confirmation: nothing acknowledges display on the device, so
  // delivered_at is deliberately never written here.
  if (notificationId && sent > 0) {
    await admin.from("notifications").update({ sent_at: now }).eq("id", notificationId).is("sent_at", null);
  }

  return { status: sent === 0 ? "failed" : sent === devices.length ? "sent" : "partial", notificationId, sent, expired, failed, devices };
}
