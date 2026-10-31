import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const findStageTrackedLeadsMock = vi.fn();
const bucketStageOverdueMock = vi.fn();
vi.mock("@/lib/rules/stage-timer", () => ({
  findStageTrackedLeads: (...args: unknown[]) => findStageTrackedLeadsMock(...args),
  bucketStageOverdue: (...args: unknown[]) => bucketStageOverdueMock(...args),
}));

const sendStageAlertsMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/rules/stage-alerts", () => ({
  sendStageAlerts: (...args: unknown[]) => sendStageAlertsMock(...args),
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

import { GET } from "./route";

const TEST_SECRET = "test-local-cron-secret-do-not-use-in-prod-1234567890";

function makeRequest(authorization: string | null): NextRequest {
  return { headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) } } as unknown as NextRequest;
}

describe("GET /api/cron/stage-timer", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_SECRET;
    findStageTrackedLeadsMock.mockReset().mockResolvedValue([]);
    bucketStageOverdueMock.mockReset().mockReturnValue({ overdueStaff: [], overdueOwner: [] });
    sendStageAlertsMock.mockClear();
    fromMock.mockReset().mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ id: "admin-1" }], error: null }) }) }),
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T05:30:00.000Z")); // 11:00 IST
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
    vi.useRealTimers();
  });

  it("returns 404 when CRON_SECRET is not configured, or the header is missing/wrong", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(makeRequest(`Bearer ${TEST_SECRET}`))).status).toBe(404);
    process.env.CRON_SECRET = TEST_SECRET;
    expect((await GET(makeRequest(null))).status).toBe(404);
    expect((await GET(makeRequest("Bearer wrong"))).status).toBe(404);
    expect(findStageTrackedLeadsMock).not.toHaveBeenCalled();
  });

  it("skips outside business hours", async () => {
    vi.setSystemTime(new Date("2026-10-31T18:30:00.000Z")); // 00:00 IST
    const response = await GET(makeRequest(`Bearer ${TEST_SECRET}`));
    expect(await response.json()).toEqual({ skipped: "outside business hours" });
    expect(findStageTrackedLeadsMock).not.toHaveBeenCalled();
  });

  it("scenario: overdue leads found -> alerts both buckets and reports counts", async () => {
    const staffLead = { id: "lead-1", assigned_to_id: "staff-1" };
    const ownerLead = { id: "lead-2", assigned_to_id: null };
    findStageTrackedLeadsMock.mockResolvedValue([staffLead, ownerLead]);
    bucketStageOverdueMock.mockReturnValue({ overdueStaff: [staffLead], overdueOwner: [ownerLead] });

    const response = await GET(makeRequest(`Bearer ${TEST_SECRET}`));

    expect(await response.json()).toEqual({ tracked: 2, alertedStaff: 1, alertedOwner: 1 });
    expect(sendStageAlertsMock).toHaveBeenCalledTimes(2);

    const [staffCall, ownerCall] = sendStageAlertsMock.mock.calls;
    expect(staffCall[2](staffLead)).toEqual(["staff-1"]);
    expect(staffCall[2](ownerLead)).toEqual(["admin-1"]);
    expect(ownerCall[2](staffLead)).toEqual(["admin-1"]);
  });
});
