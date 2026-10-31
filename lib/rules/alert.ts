import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendPushToUser } from "@/lib/push/send";

export type DedupedAlert = {
  userId: string;
  dedupeKey: string;
  type: string;
  title: string;
  body: string;
  route: string;
  entityId: string;
};

// Shared by every rules-engine alert (R-LEAD-003's response timer,
// R-STAGE-002's stage timer, and any future rule timer) -- the "deliver
// once per (user, thing)" composition is the part worth not repeating, the
// title/body copy is each rule's own.
//
// sendPushToUser only writes a `notifications` row when the recipient has
// at least one active push subscription (lib/push/send.ts) -- for anyone
// who hasn't turned push on, calling it alone would leave the alert
// invisible everywhere, not just silent. This inserts the in-app
// notification directly first (dedupe_key's unique index on (user_id,
// dedupe_key) is what makes an already-alerted (user, thing) a no-op), then
// calls sendPushToUser with the SAME dedupe_key -- it hits that existing
// row (23505), reuses its id, and still attempts the push for anyone who
// does have a device.
export async function sendDedupedAlert(admin: SupabaseClient<Database>, alert: DedupedAlert): Promise<void> {
  await admin.from("notifications").insert({
    user_id: alert.userId,
    type: alert.type,
    entity_type: "lead",
    entity_id: alert.entityId,
    title: alert.title,
    body: alert.body,
    route: alert.route,
    dedupe_key: alert.dedupeKey,
  });

  await sendPushToUser(
    alert.userId,
    { title: alert.title, body: alert.body, type: alert.type, route: alert.route },
    { dedupeKey: alert.dedupeKey, entityType: "lead", entityId: alert.entityId, ttlSeconds: 1800 },
  );
}
