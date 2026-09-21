import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lte = vi.fn();
function builder() {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "eq", "order", "limit"]) b[m] = vi.fn(chain);
  b.lte = vi.fn((...args: unknown[]) => {
    lte(...args);
    return b;
  });
  b.then = (resolve: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: () => builder() }) }));

import { getUpcomingFollowUps } from "@/lib/follow-ups";

describe("getUpcomingFollowUps 7-day window is measured in IST days", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    lte.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("at 00:30 IST on the 22nd the window ends on the 29th (UTC-based math gave the 28th)", async () => {
    vi.setSystemTime(new Date("2026-09-21T19:00:00Z"));
    await getUpcomingFollowUps();
    expect(lte).toHaveBeenCalledWith("due_date", "2026-09-29");
  });

  it("at 23:30 IST on the 21st it ends on the 28th", async () => {
    vi.setSystemTime(new Date("2026-09-21T18:00:00Z"));
    await getUpcomingFollowUps();
    expect(lte).toHaveBeenCalledWith("due_date", "2026-09-28");
  });
});
