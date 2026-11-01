import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const getDailyReportMock = vi.fn();
vi.mock("@/lib/hermes/daily-report", () => ({
  getDailyReport: (...args: unknown[]) => getDailyReportMock(...args),
}));

const recordAgentEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/hermes/agent-events", () => ({
  recordAgentEvent: (...args: unknown[]) => recordAgentEventMock(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ marker: "admin-client" }),
}));

import { GET } from "./route";

const TEST_KEY = "test-local-hermes-key-do-not-use-in-prod-1234567890";

function makeRequest(authorization: string | null, url = "http://localhost/api/hermes/reports/daily"): NextRequest {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "authorization" ? authorization : null) },
    nextUrl: new URL(url),
  } as unknown as NextRequest;
}

describe("GET /api/hermes/reports/daily", () => {
  const originalKey = process.env.HERMES_API_KEY;

  beforeEach(() => {
    process.env.HERMES_API_KEY = TEST_KEY;
    getDailyReportMock.mockReset().mockResolvedValue([]);
    recordAgentEventMock.mockClear();
    // 2026-10-31T10:00:00Z = 15:30 IST, inside 2026-10-31's business day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T10:00:00.000Z"));
  });

  afterEach(() => {
    process.env.HERMES_API_KEY = originalKey;
    vi.useRealTimers();
  });

  it("returns 404 when HERMES_API_KEY is not configured", async () => {
    delete process.env.HERMES_API_KEY;
    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));
    expect(response.status).toBe(404);
    expect(getDailyReportMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing or wrong Authorization header", async () => {
    expect((await GET(makeRequest(null))).status).toBe(404);
    expect((await GET(makeRequest("Bearer wrong-key"))).status).toBe(404);
    expect(getDailyReportMock).not.toHaveBeenCalled();
  });

  it("defaults to today's business date when no ?date is given", async () => {
    await GET(makeRequest(`Bearer ${TEST_KEY}`));
    expect(getDailyReportMock).toHaveBeenCalledWith(expect.anything(), "2026-10-31");
  });

  it("uses the provided ?date when it's a valid YYYY-MM-DD", async () => {
    await GET(makeRequest(`Bearer ${TEST_KEY}`, "http://localhost/api/hermes/reports/daily?date=2026-10-20"));
    expect(getDailyReportMock).toHaveBeenCalledWith(expect.anything(), "2026-10-20");
  });

  it("falls back to today for a malformed ?date instead of erroring", async () => {
    await GET(makeRequest(`Bearer ${TEST_KEY}`, "http://localhost/api/hermes/reports/daily?date=not-a-date"));
    expect(getDailyReportMock).toHaveBeenCalledWith(expect.anything(), "2026-10-31");
  });

  it("returns the report and logs an agent_event", async () => {
    const perStaff = [{ staffId: "s1", displayName: "Azhar", leadsIn: 2, called: 1, respondedUnder15Min: 1, visitsFixed: 0, quotesSent: 0, won: 0, lost: 0 }];
    getDailyReportMock.mockResolvedValue(perStaff);

    const response = await GET(makeRequest(`Bearer ${TEST_KEY}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ date: "2026-10-31", perStaff });
    expect(recordAgentEventMock).toHaveBeenCalledTimes(1);
    const [, loggedEvent] = recordAgentEventMock.mock.calls[0];
    expect(loggedEvent).toMatchObject({ eventType: "read", toolName: "reports.daily" });
  });
});
