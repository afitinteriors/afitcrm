import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getSystemHealth } from "./system-health";

function createFakeSupabase(lastInboundAt: string | null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.limit = vi.fn(chain);
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: lastInboundAt ? { created_at: lastInboundAt } : null, error: null }));
  const from = vi.fn(() => builder);
  return { from } as unknown as SupabaseClient<Database>;
}

// 11:00 IST = 05:30Z -- inside the default 9:00-20:00 business window.
const NOON_IST = new Date("2026-10-31T05:30:00.000Z");
// 02:00 IST = 20:30Z the previous day -- outside business hours.
const NIGHT_IST = new Date("2026-10-30T20:30:00.000Z");

describe("getSystemHealth", () => {
  it("returns nulls and not-silent when there's no inbound message at all", async () => {
    const supabase = createFakeSupabase(null);
    expect(await getSystemHealth(supabase, NOON_IST)).toEqual({
      lastInboundMessageAt: null,
      minutesSinceLastInbound: null,
      webhookSilent: false,
    });
  });

  it("flags the webhook silent once the gap reaches the threshold, inside business hours", async () => {
    const twoHoursAgo = new Date(NOON_IST.getTime() - 120 * 60_000).toISOString();
    const supabase = createFakeSupabase(twoHoursAgo);
    const result = await getSystemHealth(supabase, NOON_IST);
    expect(result.minutesSinceLastInbound).toBe(120);
    expect(result.webhookSilent).toBe(true);
  });

  it("does not flag it below the threshold", async () => {
    const oneHourAgo = new Date(NOON_IST.getTime() - 60 * 60_000).toISOString();
    const supabase = createFakeSupabase(oneHourAgo);
    const result = await getSystemHealth(supabase, NOON_IST);
    expect(result.webhookSilent).toBe(false);
  });

  it("does not flag it outside business hours, even past the threshold", async () => {
    const threeHoursAgo = new Date(NIGHT_IST.getTime() - 180 * 60_000).toISOString();
    const supabase = createFakeSupabase(threeHoursAgo);
    const result = await getSystemHealth(supabase, NIGHT_IST);
    expect(result.minutesSinceLastInbound).toBe(180);
    expect(result.webhookSilent).toBe(false);
  });
});
