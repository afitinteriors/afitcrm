import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Same minimal chainable/thenable query-builder stand-in used across this
// project's other Supabase-backed tests.
type QueryResult = { data?: unknown; error?: { message?: string } | null };

function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.is = vi.fn(chain);
  builder.or = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.gte = vi.fn(chain);
  builder.lt = vi.fn(chain);
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

let fakeSupabase: SupabaseClient<Database>;
let fakeFrom: ReturnType<typeof vi.fn>;
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => fakeSupabase,
}));

const getCurrentProfileMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getCurrentProfile: () => getCurrentProfileMock(),
}));

import { getLeads, getLeadIdsInListOrder, buildLeadsQueryString } from "./leads";

describe("getLeads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue({ id: "admin-1", role: "admin" });
    fakeFrom = vi.fn(() => makeBuilder({ data: [], error: null }));
    fakeSupabase = { from: fakeFrom } as unknown as SupabaseClient<Database>;
  });

  it("excludes retired/merged leads by filtering merged_into_id IS NULL", async () => {
    await getLeads({});

    const builder = fakeFrom.mock.results[0].value as { is: ReturnType<typeof vi.fn> };
    expect(builder.is).toHaveBeenCalledWith("merged_into_id", null);
  });

  it("still applies the existing search/status/campaign filters alongside the merge exclusion", async () => {
    await getLeads({ search: "test", status: "quotation", campaign: "traffic ad" });

    const builder = fakeFrom.mock.results[0].value as {
      is: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.is).toHaveBeenCalledWith("merged_into_id", null);
    expect(builder.or).toHaveBeenCalledWith("customer_name.ilike.%test%,phone.ilike.%test%");
    expect(builder.eq).toHaveBeenCalledWith("status", "quotation");
    expect(builder.eq).toHaveBeenCalledWith("campaign_name", "traffic ad");
  });

  it("still restricts staff to their own assigned leads alongside the merge exclusion", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "staff-1", role: "staff" });

    await getLeads({});

    const builder = fakeFrom.mock.results[0].value as { is: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> };
    expect(builder.is).toHaveBeenCalledWith("merged_into_id", null);
    expect(builder.eq).toHaveBeenCalledWith("assigned_to_id", "staff-1");
  });

  describe("Created-date filter", () => {
    it("applies a named preset as [gte, lt) bounds on created_at", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-27T10:00:00Z")); // 15:30 IST on the 27th

      await getLeads({ datePreset: "today" });

      const builder = fakeFrom.mock.results[0].value as { gte: ReturnType<typeof vi.fn>; lt: ReturnType<typeof vi.fn> };
      expect(builder.gte).toHaveBeenCalledWith("created_at", "2026-09-26T18:30:00.000Z");
      expect(builder.lt).toHaveBeenCalledWith("created_at", "2026-09-27T18:30:00.000Z");

      vi.useRealTimers();
    });

    it("applies a custom range, swapping an inverted from/to", async () => {
      await getLeads({ datePreset: "custom", dateFrom: "2026-09-10", dateTo: "2026-09-01" });

      const builder = fakeFrom.mock.results[0].value as { gte: ReturnType<typeof vi.fn>; lt: ReturnType<typeof vi.fn> };
      expect(builder.gte).toHaveBeenCalledWith("created_at", "2026-08-31T18:30:00.000Z"); // 2026-09-01T00:00 IST
      expect(builder.lt).toHaveBeenCalledWith("created_at", "2026-09-10T18:30:00.000Z"); // 2026-09-11T00:00 IST
    });

    it("combines with the existing search/status/campaign filters", async () => {
      await getLeads({ search: "test", status: "quotation", campaign: "traffic ad", datePreset: "last7" });

      const builder = fakeFrom.mock.results[0].value as {
        or: ReturnType<typeof vi.fn>;
        eq: ReturnType<typeof vi.fn>;
        gte: ReturnType<typeof vi.fn>;
        lt: ReturnType<typeof vi.fn>;
      };
      expect(builder.or).toHaveBeenCalledWith("customer_name.ilike.%test%,phone.ilike.%test%");
      expect(builder.eq).toHaveBeenCalledWith("status", "quotation");
      expect(builder.eq).toHaveBeenCalledWith("campaign_name", "traffic ad");
      expect(builder.gte).toHaveBeenCalled();
      expect(builder.lt).toHaveBeenCalled();
    });

    it("leaves created_at unfiltered when no date preset is set", async () => {
      await getLeads({ search: "test" });

      const builder = fakeFrom.mock.results[0].value as { gte: ReturnType<typeof vi.fn>; lt: ReturnType<typeof vi.fn> };
      expect(builder.gte).not.toHaveBeenCalled();
      expect(builder.lt).not.toHaveBeenCalled();
    });

    it("ignores an unrecognised preset id rather than throwing", async () => {
      await getLeads({ datePreset: "not-a-real-preset" });

      const builder = fakeFrom.mock.results[0].value as { gte: ReturnType<typeof vi.fn>; lt: ReturnType<typeof vi.fn> };
      expect(builder.gte).not.toHaveBeenCalled();
      expect(builder.lt).not.toHaveBeenCalled();
    });
  });
});

// "Save & Next"'s next-lead resolver. Reuses getLeads()'s own query builder
// internally, so these tests focus on what's actually different: an
// id-only projection, and that the filter/scope/order behavior is identical
// (proven by asserting the same calls getLeads's own tests above assert).
describe("getLeadIdsInListOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentProfileMock.mockResolvedValue({ id: "admin-1", role: "admin" });
  });

  it("selects only id, in the same order/filter/scope shape as getLeads", async () => {
    fakeFrom = vi.fn(() => makeBuilder({ data: [{ id: "lead-1" }, { id: "lead-2" }], error: null }));
    fakeSupabase = { from: fakeFrom } as unknown as SupabaseClient<Database>;

    const ids = await getLeadIdsInListOrder({ search: "test", status: "quotation", campaign: "traffic ad" });

    const builder = fakeFrom.mock.results[0].value as {
      select: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };
    expect(builder.select).toHaveBeenCalledWith("id");
    expect(builder.is).toHaveBeenCalledWith("merged_into_id", null);
    expect(builder.or).toHaveBeenCalledWith("customer_name.ilike.%test%,phone.ilike.%test%");
    expect(builder.eq).toHaveBeenCalledWith("status", "quotation");
    expect(builder.eq).toHaveBeenCalledWith("campaign_name", "traffic ad");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(ids).toEqual(["lead-1", "lead-2"]);
  });

  it("restricts staff to their own assigned leads, same as getLeads", async () => {
    getCurrentProfileMock.mockResolvedValue({ id: "staff-1", role: "staff" });
    fakeFrom = vi.fn(() => makeBuilder({ data: [], error: null }));
    fakeSupabase = { from: fakeFrom } as unknown as SupabaseClient<Database>;

    await getLeadIdsInListOrder({});

    const builder = fakeFrom.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
    expect(builder.eq).toHaveBeenCalledWith("assigned_to_id", "staff-1");
  });

  it("returns an empty list rather than throwing when there is no signed-in profile", async () => {
    getCurrentProfileMock.mockResolvedValue(null);
    fakeFrom = vi.fn(() => makeBuilder({ data: [], error: null }));
    fakeSupabase = { from: fakeFrom } as unknown as SupabaseClient<Database>;

    expect(await getLeadIdsInListOrder({})).toEqual([]);
    expect(fakeFrom).not.toHaveBeenCalled();
  });
});

describe("buildLeadsQueryString", () => {
  it("includes only the filters that are actually set", () => {
    expect(buildLeadsQueryString({})).toBe("");
    expect(buildLeadsQueryString({ search: "vinod" })).toBe("search=vinod");
    expect(buildLeadsQueryString({ search: "vinod", status: "new", campaign: "traffic ad" })).toBe(
      "search=vinod&status=new&campaign=traffic+ad"
    );
  });

  it("carries a named date preset", () => {
    expect(buildLeadsQueryString({ datePreset: "last7" })).toBe("datePreset=last7");
  });

  it("carries dateFrom/dateTo only for the custom preset", () => {
    expect(buildLeadsQueryString({ datePreset: "custom", dateFrom: "2026-09-01", dateTo: "2026-09-10" })).toBe(
      "datePreset=custom&dateFrom=2026-09-01&dateTo=2026-09-10"
    );
    // A named preset never carries stray dateFrom/dateTo, even if present in the input.
    expect(buildLeadsQueryString({ datePreset: "today", dateFrom: "2026-09-01", dateTo: "2026-09-10" })).toBe(
      "datePreset=today"
    );
  });

  it("drops an unrecognised preset id", () => {
    expect(buildLeadsQueryString({ datePreset: "not-a-real-preset" })).toBe("");
  });
});
