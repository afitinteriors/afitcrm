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

import { getLeads } from "./leads";

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
});
