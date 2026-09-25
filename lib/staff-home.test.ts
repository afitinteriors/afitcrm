import { describe, it, expect } from "vitest";
import { buildStaffHome, type StaffHomeLead } from "@/lib/staff-home";
import { buildDutyItems } from "@/lib/duty";
import type { DutyItem } from "@/lib/duty";
import type { UncontactedLead } from "@/lib/leads";

const TODAY = "2026-09-25";

function duty(overrides: Partial<DutyItem> & Pick<DutyItem, "reasonKind">): DutyItem {
  return {
    key: `k:${overrides.leadId ?? overrides.conversationId}:${overrides.reasonKind}`,
    tier: 1,
    leadId: null,
    conversationId: null,
    followUpId: null,
    customerName: "Customer",
    phone: "+919000000000",
    stage: null,
    assignedToName: null,
    reasonText: "internal reason text",
    actionLabel: "Open",
    sortAt: "2026-09-20T08:00:00Z",
    ...overrides,
  };
}

function lead(id: string, overrides: Partial<StaffHomeLead> = {}): StaffHomeLead {
  return { id, status: "contacted", service_required: "Gypsum Plaster", created_at: "2026-09-20T08:00:00Z", ...overrides };
}

const keysOf = (items: { leadId: string | null; conversationId: string | null }[]) => items.map((i) => i.leadId ?? i.conversationId);

describe("buildStaffHome -- the three sections", () => {
  it("overdue -> Follow up now, due today -> Follow up today, uncontacted -> New leads", () => {
    const b = buildStaffHome({
      dutyItems: [
        duty({ reasonKind: "overdue_follow_up", leadId: "a", followUpId: "fa", stage: "quotation" }),
        duty({ reasonKind: "due_today_follow_up", leadId: "b", followUpId: "fb", stage: "contacted" }),
        duty({ reasonKind: "uncontacted_lead", leadId: "c", stage: "new" }),
      ],
      leads: [lead("a", { status: "quotation" }), lead("b"), lead("c", { status: "new" })],
      followUps: [
        { id: "fa", due_date: "2026-09-22", due_time: "10:30:00" },
        { id: "fb", due_date: TODAY, due_time: null },
      ],
    });

    expect(keysOf(b.followUpNow)).toEqual(["a"]);
    expect(b.followUpNow[0]).toMatchObject({ statusLabel: "Follow-up overdue", stage: "quotation", dueDate: "2026-09-22", dueTime: "10:30:00", serviceRequired: "Gypsum Plaster" });
    expect(keysOf(b.followUpToday)).toEqual(["b"]);
    expect(b.followUpToday[0].statusLabel).toBe("Follow-up today");
    expect(keysOf(b.newLeads)).toEqual(["c"]);
    expect(b.newLeads[0].statusLabel).toBe("New lead");
    expect(b.other).toEqual([]);
  });

  it("a fresh WhatsApp lead (canonical winner 'unanswered', lead still New) is shown under New leads, not hidden", () => {
    const b = buildStaffHome({
      dutyItems: [duty({ reasonKind: "unanswered_conversation", leadId: "w", conversationId: "cw" })],
      leads: [lead("w", { status: "new" })],
      followUps: [],
    });

    expect(keysOf(b.newLeads)).toEqual(["w"]);
    expect(b.newLeads[0]).toMatchObject({ stage: "new", tone: "new" });
  });

  it("an unanswered conversation not yet linked to any lead is a New lead, opening its conversation", () => {
    const b = buildStaffHome({
      dutyItems: [duty({ reasonKind: "unanswered_conversation", conversationId: "orphan" })],
      leads: [],
      followUps: [],
    });

    expect(b.newLeads).toHaveLength(1);
    expect(b.newLeads[0]).toMatchObject({ leadId: null, conversationId: "orphan", stage: null });
  });

  it("a customer reply on an already-contacted lead and a lead with no next step go to the quieter 'Also check' list", () => {
    const b = buildStaffHome({
      dutyItems: [
        duty({ reasonKind: "unanswered_conversation", leadId: "r", conversationId: "cr" }),
        duty({ reasonKind: "no_follow_up", leadId: "n", stage: "qualified" }),
      ],
      leads: [lead("r", { status: "quotation" }), lead("n", { status: "qualified" })],
      followUps: [],
    });

    expect(b.other.map((i) => [i.leadId, i.statusLabel])).toEqual([
      ["r", "Customer replied"],
      ["n", "No next action"],
    ]);
    expect(b.newLeads).toEqual([]);
  });

  it("never exposes internal Duty wording in any label", () => {
    const b = buildStaffHome({
      dutyItems: (["overdue_follow_up", "due_today_follow_up", "unanswered_conversation", "uncontacted_lead", "no_follow_up"] as const).map((k, i) =>
        duty({ reasonKind: k, leadId: `l${i}` }),
      ),
      leads: [],
      followUps: [],
    });
    const labels = [...b.newLeads, ...b.followUpNow, ...b.followUpToday, ...b.other].map((i) => i.statusLabel).join(" | ");
    expect(labels).not.toMatch(/duty|signal|reason|canonical|tier/i);
  });
});

describe("buildStaffHome -- one lead, one card", () => {
  it("a lead that is overdue AND unanswered AND uncontacted shows exactly once, under Follow up now", () => {
    // Real canonical derivation, not hand-built items: this is the dedup
    // Staff Home relies on.
    const dutyItems = buildDutyItems({
      pendingFollowUps: [
        {
          id: "f1",
          lead_id: "x",
          type: "call",
          due_date: "2026-09-23",
          due_time: null,
          notes: null,
          lead: { customer_name: "X", phone: "+919000000001", status: "new", assigned: null },
        },
      ],
      unanswered: [{ id: "cx", wa_id: "919000000001", lastInboundAt: "2026-09-25T06:00:00Z", lead: { id: "x", customer_name: "X", assigned: null } }],
      uncontactedLeads: [{ id: "x", customer_name: "X", phone: "+919000000001", status: "new", created_at: "2026-09-20T00:00:00Z", assigned: null } as unknown as UncontactedLead],
      noFollowUpLeads: [],
      today: TODAY,
    });

    const b = buildStaffHome({ dutyItems, leads: [lead("x", { status: "new" })], followUps: [{ id: "f1", due_date: "2026-09-23", due_time: null }] });
    const all = [...b.newLeads, ...b.followUpNow, ...b.followUpToday, ...b.other];

    expect(all.filter((i) => i.leadId === "x")).toHaveLength(1);
    expect(keysOf(b.followUpNow)).toEqual(["x"]);
  });

  it("every canonical item lands in exactly one list (nothing dropped, nothing doubled)", () => {
    const dutyItems = [
      duty({ reasonKind: "overdue_follow_up", leadId: "1" }),
      duty({ reasonKind: "due_today_follow_up", leadId: "2" }),
      duty({ reasonKind: "unanswered_conversation", leadId: "3", conversationId: "c3" }),
      duty({ reasonKind: "uncontacted_lead", leadId: "4" }),
      duty({ reasonKind: "no_follow_up", leadId: "5" }),
      duty({ reasonKind: "unanswered_conversation", conversationId: "c6" }),
    ];
    const b = buildStaffHome({ dutyItems, leads: [lead("3", { status: "negotiation" })], followUps: [] });

    expect(b.newLeads.length + b.followUpNow.length + b.followUpToday.length + b.other.length).toBe(dutyItems.length);
  });
});

describe("buildStaffHome -- ordering", () => {
  it("New leads: newest first. Follow up now: most overdue first. Today: timed before untimed, earliest first", () => {
    const b = buildStaffHome({
      dutyItems: [
        duty({ reasonKind: "uncontacted_lead", leadId: "old" }),
        duty({ reasonKind: "uncontacted_lead", leadId: "fresh" }),
        duty({ reasonKind: "overdue_follow_up", leadId: "o2", followUpId: "fo2" }),
        duty({ reasonKind: "overdue_follow_up", leadId: "o1", followUpId: "fo1" }),
        duty({ reasonKind: "due_today_follow_up", leadId: "untimed", followUpId: "fu" }),
        duty({ reasonKind: "due_today_follow_up", leadId: "t14", followUpId: "f14" }),
        duty({ reasonKind: "due_today_follow_up", leadId: "t09", followUpId: "f09" }),
      ],
      leads: [
        lead("old", { status: "new", created_at: "2026-09-20T08:00:00Z" }),
        lead("fresh", { status: "new", created_at: "2026-09-25T08:00:00Z" }),
      ],
      followUps: [
        { id: "fo2", due_date: "2026-09-24", due_time: null },
        { id: "fo1", due_date: "2026-09-21", due_time: null },
        { id: "fu", due_date: TODAY, due_time: null },
        { id: "f14", due_date: TODAY, due_time: "14:00:00" },
        { id: "f09", due_date: TODAY, due_time: "09:00:00" },
      ],
    });

    expect(keysOf(b.newLeads)).toEqual(["fresh", "old"]);
    expect(keysOf(b.followUpNow)).toEqual(["o1", "o2"]);
    expect(keysOf(b.followUpToday)).toEqual(["t09", "t14", "untimed"]);
  });

  it("falls back to the canonical item's own fields when the lead/follow-up record isn't in the display fetch", () => {
    const b = buildStaffHome({
      dutyItems: [duty({ reasonKind: "overdue_follow_up", leadId: "gone", stage: "contacted", sortAt: "2026-09-22", followUpId: "missing" })],
      leads: [],
      followUps: [],
    });

    expect(b.followUpNow[0]).toMatchObject({ leadId: "gone", stage: "contacted", dueDate: "2026-09-22", serviceRequired: null });
  });
});
