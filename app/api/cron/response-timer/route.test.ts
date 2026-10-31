import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

// Route-level test: auth guard, business-hours gate, and that it wires the
// rules-engine pieces together correctly. The rules themselves (overdue
// bucketing, who counts as "responded") are covered directly in
// lib/rules/response-timer.test.ts and lib/rules/response-alerts.test.ts
// against fake Supabase clients -- mocked here so this file stays about the
// route's own job only.
const findUnrespondedLeadsMock = vi.fn();
const bucketByOverdueMock = vi.fn();
vi.mock("@/lib/rules/response-timer", () => ({
  findUnrespondedLeads: (...args: unknown[]) => findUnrespondedLeadsMock(...args),
  bucketByOverdue: (...args: unknown[]) => bucketByOverdueMock(...args),
}));

const sendResponseAlertsMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/rules/response-alerts", () => ({
  sendResponseAlerts: (...args: unknown[]) => sendResponseAlertsMock(...args),
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

describe("GET /api/cron/response-timer", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_SECRET;
    findUnrespondedLeadsMock.mockReset().mockResolvedValue([]);
    bucketByOverdueMock.mockReset().mockReturnValue({ overdueStaff: [], overdueOwner: [] });
    sendResponseAlertsMock.mockClear();
    fromMock.mockReset().mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ id: "admin-1" }], error: null }) }) }),
    });
    // 11:00 IST = 05:30Z -- inside the default 9:00-20:00 business window.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T05:30:00.000Z"));
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
    vi.useRealTimers();
  });

  it("returns 404 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(makeRequest(`Bearer ${TEST_SECRET}`));
    expect(response.status).toBe(404);
    expect(findUnrespondedLeadsMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await GET(makeRequest(null))).status).toBe(404);
    expect((await GET(makeRequest("Bearer wrong-secret"))).status).toBe(404);
    expect(findUnrespondedLeadsMock).not.toHaveBeenCalled();
  });

  it("skips outside business hours without querying anything", async () => {
    vi.setSystemTime(new Date("2026-10-31T18:30:00.000Z")); // 00:00 IST
    const response = await GET(makeRequest(`Bearer ${TEST_SECRET}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ skipped: "outside business hours" });
    expect(findUnrespondedLeadsMock).not.toHaveBeenCalled();
    expect(sendResponseAlertsMock).not.toHaveBeenCalled();
  });

  it("scenario: valid secret, business hours, nothing overdue -> 200 with zero counts", async () => {
    const response = await GET(makeRequest(`Bearer ${TEST_SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked: 0, alertedStaff: 0, alertedOwner: 0 });
    // sendResponseAlerts is still called (with empty lead lists) -- it
    // no-ops on its own (see lib/rules/response-alerts.test.ts's "does
    // nothing for an empty lead list"), so asserting zero *alerts sent* is
    // its job, not a reason for the route to special-case the empty case.
    expect(sendResponseAlertsMock).toHaveBeenCalledTimes(2);
  });

  it("scenario: overdue leads found -> alerts staff and owner buckets separately, reports counts", async () => {
    const staffLead = { id: "lead-1", assigned_to_id: "staff-1" };
    const ownerLead = { id: "lead-2", assigned_to_id: null };
    findUnrespondedLeadsMock.mockResolvedValue([staffLead, ownerLead]);
    bucketByOverdueMock.mockReturnValue({ overdueStaff: [staffLead], overdueOwner: [ownerLead] });

    const response = await GET(makeRequest(`Bearer ${TEST_SECRET}`));

    expect(await response.json()).toEqual({ checked: 2, alertedStaff: 1, alertedOwner: 1 });
    expect(sendResponseAlertsMock).toHaveBeenCalledTimes(2);

    const [staffCall, ownerCall] = sendResponseAlertsMock.mock.calls;
    expect(staffCall[1]).toEqual([staffLead]);
    expect(staffCall[3]).toBe("staff");
    expect(staffCall[2](staffLead)).toEqual(["staff-1"]); // assigned staff gets the 15-min alert
    expect(staffCall[2](ownerLead)).toEqual(["admin-1"]); // unassigned falls back to admins

    expect(ownerCall[1]).toEqual([ownerLead]);
    expect(ownerCall[3]).toBe("owner");
    expect(ownerCall[2](staffLead)).toEqual(["admin-1"]); // owner bucket always goes to admins
  });
});
