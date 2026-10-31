import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { UnrespondedLead } from "./response-timer";

const sendPushToUserMock = vi.fn().mockResolvedValue({ status: "sent", notificationId: "n1", sent: 1, expired: 0, failed: 0, devices: [] });
vi.mock("@/lib/push/send", () => ({
  sendPushToUser: (...args: unknown[]) => sendPushToUserMock(...args),
}));

import { sendResponseAlerts } from "./response-alerts";

function makeAdminStub() {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn(() => ({ insert }));
  return { stub: { from } as unknown as SupabaseClient<Database>, from, insert };
}

function lead(overrides: Partial<UnrespondedLead> = {}): UnrespondedLead {
  return {
    id: "lead-1",
    customer_name: "Rahul K.",
    phone: "+919999999999",
    assigned_to_id: "staff-1",
    created_at: "2026-10-31T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  sendPushToUserMock.mockClear();
});

describe("sendResponseAlerts", () => {
  it("inserts one notifications row and sends one push per (lead, recipient)", async () => {
    const { stub, from, insert } = makeAdminStub();
    const l = lead();

    await sendResponseAlerts(stub, [l], () => ["staff-1"], "staff");

    expect(from).toHaveBeenCalledWith("notifications");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "staff-1",
        type: "lead.response_overdue_staff",
        entity_type: "lead",
        entity_id: "lead-1",
        route: "/leads/lead-1",
        dedupe_key: "lead-response-staff:lead-1",
      }),
    );
    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);
    expect(sendPushToUserMock).toHaveBeenCalledWith(
      "staff-1",
      expect.objectContaining({ type: "lead.response_overdue_staff", route: "/leads/lead-1" }),
      expect.objectContaining({ dedupeKey: "lead-response-staff:lead-1" }),
    );
  });

  it("uses the owner dedupe key and copy for the owner bucket", async () => {
    const { stub, insert } = makeAdminStub();
    await sendResponseAlerts(stub, [lead()], () => ["admin-1"], "owner");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ dedupe_key: "lead-response-owner:lead-1", type: "lead.response_overdue_owner" }));
  });

  it("alerts every recipient the caller supplies (e.g. all admins for an unassigned lead)", async () => {
    const { stub, insert } = makeAdminStub();
    await sendResponseAlerts(stub, [lead({ assigned_to_id: null })], () => ["admin-1", "admin-2"], "staff");
    expect(insert).toHaveBeenCalledTimes(2);
    expect(sendPushToUserMock).toHaveBeenCalledTimes(2);
  });

  it("does nothing for an empty lead list", async () => {
    const { stub, insert } = makeAdminStub();
    await sendResponseAlerts(stub, [], () => ["admin-1"], "staff");
    expect(insert).not.toHaveBeenCalled();
    expect(sendPushToUserMock).not.toHaveBeenCalled();
  });
});
