import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { StageTrackedLead } from "./stage-timer";

const sendPushToUserMock = vi.fn().mockResolvedValue({ status: "sent", notificationId: "n1", sent: 1, expired: 0, failed: 0, devices: [] });
vi.mock("@/lib/push/send", () => ({
  sendPushToUser: (...args: unknown[]) => sendPushToUserMock(...args),
}));

import { sendStageAlerts } from "./stage-alerts";

function makeAdminStub() {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn(() => ({ insert }));
  return { stub: { from } as unknown as SupabaseClient<Database>, from, insert };
}

function lead(overrides: Partial<StageTrackedLead> = {}): StageTrackedLead {
  return {
    id: "lead-1",
    customer_name: "Rahul K.",
    phone: "+919999999999",
    assigned_to_id: "staff-1",
    status: "qualified",
    status_changed_at: "2026-10-29T10:00:00.000Z",
    site_visit_date: null,
    quotation_amount: null,
    ...overrides,
  };
}

beforeEach(() => {
  sendPushToUserMock.mockClear();
});

describe("sendStageAlerts", () => {
  it("dedupe key includes the lead's status, not just its id", async () => {
    const { stub, insert } = makeAdminStub();
    await sendStageAlerts(stub, [lead({ status: "negotiation" })], () => ["staff-1"], "staff");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ dedupe_key: "lead-stage-staff:lead-1:negotiation", type: "lead.stage_overdue_staff" }),
    );
  });

  it("a lead overdue in a DIFFERENT stage later gets its own alert (different dedupe key)", async () => {
    const { stub, insert } = makeAdminStub();
    await sendStageAlerts(stub, [lead({ status: "qualified" })], () => ["staff-1"], "staff");
    await sendStageAlerts(stub, [lead({ status: "negotiation" })], () => ["staff-1"], "staff");
    const keys = insert.mock.calls.map((c) => (c[0] as { dedupe_key: string }).dedupe_key);
    expect(keys).toEqual(["lead-stage-staff:lead-1:qualified", "lead-stage-staff:lead-1:negotiation"]);
  });

  it("owner bucket uses its own dedupe key and copy", async () => {
    const { stub, insert } = makeAdminStub();
    await sendStageAlerts(stub, [lead()], () => ["admin-1"], "owner");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ dedupe_key: "lead-stage-owner:lead-1:qualified", type: "lead.stage_overdue_owner" }));
  });

  it("does nothing for an empty lead list", async () => {
    const { stub, insert } = makeAdminStub();
    await sendStageAlerts(stub, [], () => ["admin-1"], "staff");
    expect(insert).not.toHaveBeenCalled();
    expect(sendPushToUserMock).not.toHaveBeenCalled();
  });
});
