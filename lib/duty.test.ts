import { describe, it, expect } from "vitest";
import { buildDutyItems, DUTY_TIER, type DutyFollowUpWithLead, type DutyLeadWithoutFollowUp } from "@/lib/duty";
import type { UnansweredConversation } from "@/lib/conversations";
import type { UncontactedLead } from "@/lib/leads";

// lib/duty.ts is the ONE canonical Duty derivation (Duty Architecture Audit
// Phase 2). These tests exercise buildDutyItems() directly -- no Supabase
// mocking needed, since it's a pure function over already-fetched signals.
// lib/dashboard-brain.test.ts covers the same guarantees end-to-end through
// getMyDutyQueue(); this file is the direct, fast proof for the shared core.

const TODAY = "2026-09-24";

const leadStub = { customer_name: "Lead", phone: "+919000000000", status: "contacted" as const, assigned: null };

function followUp(overrides: Partial<DutyFollowUpWithLead> = {}): DutyFollowUpWithLead {
  return {
    id: "fu-1",
    lead_id: "lead-1",
    type: "call",
    due_date: TODAY,
    due_time: null,
    notes: null,
    lead: leadStub,
    ...overrides,
  };
}

function unansweredConvo(overrides: Partial<UnansweredConversation> = {}): UnansweredConversation {
  return {
    id: "conv-1",
    wa_id: "+919000000001",
    lastInboundAt: "2026-09-24T03:00:00Z",
    lead: { id: "lead-1", customer_name: "Lead", assigned: null },
    ...overrides,
  };
}

function uncontacted(overrides: Partial<UncontactedLead> = {}): UncontactedLead {
  return {
    id: "lead-1",
    customer_name: "Lead",
    phone: "+919000000001",
    status: "new",
    created_at: "2026-09-24T02:00:00Z",
    assigned: null,
    ...overrides,
  } as UncontactedLead;
}

function noFollowUpLead(overrides: Partial<DutyLeadWithoutFollowUp> = {}): DutyLeadWithoutFollowUp {
  return {
    id: "lead-1",
    customer_name: "Lead",
    phone: "+919000000002",
    status: "qualified",
    created_at: "2026-09-01T00:00:00Z",
    assigned: null,
    ...overrides,
  };
}

const empty = { pendingFollowUps: [], unanswered: [], uncontactedLeads: [], noFollowUpLeads: [], today: TODAY };

describe("buildDutyItems -- winning duty per lead (A)", () => {
  it("a lead that is both unanswered AND uncontacted produces exactly ONE winning duty item", () => {
    const items = buildDutyItems({
      ...empty,
      unanswered: [unansweredConvo()],
      uncontactedLeads: [uncontacted()],
    });

    const forLead = items.filter((i) => i.leadId === "lead-1");
    expect(forLead).toHaveLength(1);
    expect(forLead[0].reasonKind).toBe("unanswered_conversation"); // tier 3 beats tier 4
  });

  it("a lead with an overdue follow-up AND an unanswered conversation wins as overdue (tier 1 beats tier 3)", () => {
    const items = buildDutyItems({
      ...empty,
      pendingFollowUps: [followUp({ due_date: "2026-09-20" })], // overdue relative to TODAY
      unanswered: [unansweredConvo()],
    });

    const forLead = items.filter((i) => i.leadId === "lead-1");
    expect(forLead).toHaveLength(1);
    expect(forLead[0].reasonKind).toBe("overdue_follow_up");
  });
});

describe("buildDutyItems -- documented priority order (B)", () => {
  const cases: { setup: Parameters<typeof buildDutyItems>[0]; expected: string }[] = [
    { setup: { ...empty, pendingFollowUps: [followUp({ due_date: "2026-09-20" })] }, expected: "overdue_follow_up" },
    { setup: { ...empty, pendingFollowUps: [followUp({ due_date: TODAY })] }, expected: "due_today_follow_up" },
    { setup: { ...empty, unanswered: [unansweredConvo()] }, expected: "unanswered_conversation" },
    { setup: { ...empty, uncontactedLeads: [uncontacted()] }, expected: "uncontacted_lead" },
    { setup: { ...empty, noFollowUpLeads: [noFollowUpLead()] }, expected: "no_follow_up" },
  ];

  it.each(cases)("in isolation, each signal produces its documented reasonKind: $expected", ({ setup, expected }) => {
    const items = buildDutyItems(setup);
    expect(items.map((i) => i.reasonKind)).toEqual([expected]);
  });

  it("tier order is overdue > due today > unanswered > uncontacted > no-follow-up, for five distinct leads", () => {
    const items = buildDutyItems({
      pendingFollowUps: [
        followUp({ id: "fu-overdue", lead_id: "lead-overdue", due_date: "2026-09-20", lead: leadStub }),
        followUp({ id: "fu-due-today", lead_id: "lead-due-today", due_date: TODAY, lead: leadStub }),
      ],
      unanswered: [unansweredConvo({ lead: { id: "lead-unanswered", customer_name: "Lead", assigned: null } })],
      uncontactedLeads: [uncontacted({ id: "lead-uncontacted" })],
      noFollowUpLeads: [noFollowUpLead({ id: "lead-no-follow-up" })],
      today: TODAY,
    });

    expect(items.map((i) => i.reasonKind)).toEqual([
      "overdue_follow_up",
      "due_today_follow_up",
      "unanswered_conversation",
      "uncontacted_lead",
      "no_follow_up",
    ]);
  });
});

describe("buildDutyItems -- no-follow-up on a genuinely open, non-new lead (C)", () => {
  it("a qualified lead with no pending follow-up appears as a no_follow_up duty item", () => {
    const items = buildDutyItems({ ...empty, noFollowUpLeads: [noFollowUpLead({ status: "qualified" })] });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ reasonKind: "no_follow_up", stage: "qualified", tier: DUTY_TIER.NO_FOLLOW_UP });
  });

  it("also works for quotation/negotiation stages (stalledPipeline's source)", () => {
    const items = buildDutyItems({
      ...empty,
      noFollowUpLeads: [noFollowUpLead({ id: "lead-quo", status: "quotation" }), noFollowUpLead({ id: "lead-neg", status: "negotiation" })],
    });
    expect(items.map((i) => i.stage)).toEqual(["quotation", "negotiation"]);
  });
});

describe("buildDutyItems -- follow-up due/overdue classification (F)", () => {
  it("a follow-up due in the future is not part of the attention queue at all", () => {
    const items = buildDutyItems({ ...empty, pendingFollowUps: [followUp({ due_date: "2026-10-01" })] });
    expect(items).toEqual([]);
  });

  it("a follow-up on exactly today's business date is due_today, not overdue", () => {
    const items = buildDutyItems({ ...empty, pendingFollowUps: [followUp({ due_date: TODAY })] });
    expect(items[0].reasonKind).toBe("due_today_follow_up");
  });

  it("a lead with no lead record on the follow-up row is skipped (closed/missing lead)", () => {
    const items = buildDutyItems({ ...empty, pendingFollowUps: [followUp({ lead: null })] });
    expect(items).toEqual([]);
  });
});

describe("buildDutyItems -- items with no leadId are never deduped against each other", () => {
  it("two unanswered conversations with no linked lead both survive", () => {
    const items = buildDutyItems({
      ...empty,
      unanswered: [
        unansweredConvo({ id: "conv-a", lead: null }),
        unansweredConvo({ id: "conv-b", lead: null }),
      ],
    });
    expect(items).toHaveLength(2);
  });
});
