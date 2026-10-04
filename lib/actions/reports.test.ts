import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ profile: null as { id: string; role: string } | null }));
const getReportsData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getCurrentProfile: async () => state.profile }));
vi.mock("@/lib/reports", () => ({ getReportsData }));

import { exportReportsData } from "./reports";

const FILTERS = { datePreset: "last30", dateFrom: "", dateTo: "" };

describe("exportReportsData (server-enforced admin-only export)", () => {
  beforeEach(() => {
    getReportsData.mockReset();
    getReportsData.mockResolvedValue({ period: { from: "2026-09-05", to: "2026-10-04" } });
  });

  it("returns the report data for an admin", async () => {
    state.profile = { id: "admin-1", role: "admin" };
    const result = await exportReportsData(FILTERS);
    expect(result).toEqual({ data: { period: { from: "2026-09-05", to: "2026-10-04" } } });
    expect(getReportsData).toHaveBeenCalledWith(FILTERS);
  });

  it("refuses a staff caller and never computes the export data", async () => {
    state.profile = { id: "staff-1", role: "staff" };
    const result = await exportReportsData(FILTERS);
    expect(result).toEqual({ error: "Only an admin can export reports." });
    expect(getReportsData).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    state.profile = null;
    const result = await exportReportsData(FILTERS);
    expect(result).toEqual({ error: "Only an admin can export reports." });
    expect(getReportsData).not.toHaveBeenCalled();
  });
});
