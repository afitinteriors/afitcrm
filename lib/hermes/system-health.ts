import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isBusinessHours } from "@/lib/business-time";
import { BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR, WEBHOOK_SILENCE_ALERT_MINUTES } from "@/lib/constants";

export type SystemHealth = {
  lastInboundMessageAt: string | null;
  minutesSinceLastInbound: number | null;
  webhookSilent: boolean;
};

// Blueprint V1 Section 9, Phase 5: the "System health" job's data source
// ("Webhook silent too long, failed sends, AI errors, template rejections"
// -- every 15 minutes). Scoped to ONLY what's reliably real on this app's
// CURRENT live setup (WABIS, no Meta Cloud API, no customer AI agent yet):
//
//  - "Webhook silent too long": the one signal this covers. The most
//    recent INBOUND message's timestamp is a tighter proxy than
//    leads.created_at (a repeat customer messaging an existing lead is
//    still live webhook traffic, even though no new lead is created).
//    Flagged only inside business hours -- same "timers pause outside
//    them" rule as R-LEAD-003/R-STAGE-002; the webhook being quiet
//    overnight is expected, not a fault.
//
//  - "Failed sends": app/api/webhooks/whatsapp/route.ts already updates
//    messages.status from Meta's delivery-status callbacks, but that
//    webhook is for the Meta Cloud API path -- this project is still on
//    WABIS (Phase 9, the Meta migration, hasn't happened). There is
//    currently no live path that would ever populate a "failed" status,
//    so a tool reporting "0 failed sends" here would look like a real
//    all-clear when it's actually "not measured yet" -- exactly the "no
//    fake numbers ... pretend integrations" CLAUDE.md forbids. Deliberately
//    not built; revisit once Phase 9 ships.
//
//  - "AI errors" / "template rejections": no customer AI agent (Phase 6)
//    or WhatsApp template system exists yet to have errors or rejections.
//    Not built.
export async function getSystemHealth(supabase: SupabaseClient<Database>, now: Date): Promise<SystemHealth> {
  const { data } = await supabase
    .from("messages")
    .select("created_at")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastInboundMessageAt = data?.created_at ?? null;
  if (!lastInboundMessageAt) {
    return { lastInboundMessageAt: null, minutesSinceLastInbound: null, webhookSilent: false };
  }

  const minutesSinceLastInbound = Math.round((now.getTime() - new Date(lastInboundMessageAt).getTime()) / 60_000);
  const withinBusinessHours = isBusinessHours(now, BUSINESS_HOURS_START_HOUR, BUSINESS_HOURS_END_HOUR);
  const webhookSilent = withinBusinessHours && minutesSinceLastInbound >= WEBHOOK_SILENCE_ALERT_MINUTES;

  return { lastInboundMessageAt, minutesSinceLastInbound, webhookSilent };
}
