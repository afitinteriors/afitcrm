"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { cleanUserAgent, parsePushSubscription } from "@/lib/push/subscription";
import { sendPushToUser } from "@/lib/push/send";

export type PushActionState = { error: string } | { ok: true };

// A user with more active devices than this is almost certainly a bug or
// abuse -- a person has a handful of browsers, not dozens.
const MAX_ACTIVE_SUBSCRIPTIONS = 10;

const NOT_SIGNED_IN = "Not signed in.";

// Subscribe the calling browser/device. user_id is ALWAYS taken from the
// session (getCurrentProfile), never from the client -- the payload carries
// only the subscription itself. Ownership is enforced twice: here, and by
// the push_subscriptions RLS policies (insert/update require user_id =
// auth.uid()).
export async function subscribePush(input: unknown, userAgent?: unknown): Promise<PushActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: NOT_SIGNED_IN };

  const subscription = parsePushSubscription(input);
  if (!subscription) return { error: "Invalid push subscription." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE_SUBSCRIPTIONS) {
    return { error: "Too many devices are already enabled. Turn one off first." };
  }

  const row = {
    user_id: profile.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    user_agent: cleanUserAgent(userAgent),
    revoked_at: null,
  };

  const { error } = await supabase.from("push_subscriptions").insert(row);
  if (!error) return { ok: true };

  if (error.code !== "23505") return { error: "Could not save this device. Try again." };

  // The endpoint already exists: either this same user re-enabling, or the
  // same browser previously used by someone else. The caller has just
  // obtained this subscription from their own browser, so it is theirs now;
  // re-point it with the service-role client (RLS would hide another user's
  // row from the user client). last_success_at is reset -- it described the
  // previous owner's deliveries.
  const admin = createAdminClient();
  const { error: reassignError } = await admin
    .from("push_subscriptions")
    .update({ ...row, last_success_at: null })
    .eq("endpoint", subscription.endpoint);
  if (reassignError) return { error: "Could not save this device. Try again." };
  return { ok: true };
}

// Revoke this browser's subscription. Scoped to the caller's own rows by
// both the explicit user_id filter and RLS, so an endpoint belonging to
// someone else is simply not matched.
export async function unsubscribePush(endpoint: unknown): Promise<PushActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: NOT_SIGNED_IN };
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 2048) {
    return { error: "Invalid push subscription." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("endpoint", endpoint);
  if (error) return { error: "Could not turn off this device. Try again." };
  return { ok: true };
}

export type TestPushState = { error: string } | { ok: true; sent: number };

const TEST_RATE_LIMIT = 3;
const TEST_RATE_WINDOW_MS = 60_000;

// Manual "Send test notification". Deliberately takes NO arguments: the
// recipient is always the signed-in user (from the session), so neither a
// client nor a staff account can aim a push at anyone else's device. There is
// no HTTP route for this -- it is a server action, callable only from an
// authenticated page.
export async function sendTestNotification(): Promise<TestPushState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: NOT_SIGNED_IN };

  // Cheap abuse guard, read through the user's own RLS-scoped session.
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("type", "test")
    .gte("created_at", new Date(Date.now() - TEST_RATE_WINDOW_MS).toISOString());
  if ((count ?? 0) >= TEST_RATE_LIMIT) return { error: "Please wait a minute before sending another test." };

  const result = await sendPushToUser(
    profile.id,
    {
      title: "AFIT CRM test notification",
      body: "Push notifications are working on this device.",
      type: "test",
      route: "/notifications",
    },
    // Unique per click, so every click really sends (and gets a history row).
    { dedupeKey: `test:${crypto.randomUUID()}`, ttlSeconds: 300 },
  );

  switch (result.status) {
    case "sent":
    case "partial":
      return { ok: true, sent: result.sent };
    case "no_subscriptions":
      return { error: "No device is enabled yet. Turn notifications on first." };
    case "vapid_not_configured":
      // Symbolic code only (see lib/push/config.ts) -- never a configured value.
      return { error: `Push delivery configuration error: ${result.reason}` };
    case "failed":
      return {
        error:
          result.expired > 0 && result.failed === 0
            ? "This device's subscription has expired. Turn notifications off and on again."
            : "The push service didn't accept the message. Try again shortly.",
      };
    default:
      return { error: "Could not send the test notification." };
  }
}
