import { describe, it, expect } from "vitest";
import { buildTodayBoard, type TodayFollowUp, type TodayLead } from "@/lib/today";
import { buildDutyItems, type DutyItem, type DutyFollowUpWithLead, type DutyLeadWithoutFollowUp } from "@/lib/duty";
import type { UncontactedLead } from "@/lib/leads";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";

const TODAY = "2026-09-20";
const YESTERDAY = "2026-09-19";
const TOMORROW = "2026-09-21";

let seq = 0;
function lead(overrides: Partial<TodayLead> = {}): TodayLead {
  seq += 1;
  return {
    id: `lead-${seq}`,
    customer_name: `Customer ${seq}`,
    phone: `+9190000000${String(seq).padStart(2, "0")}`,
    status: "contacted",
    assigned: { display_name: "Azhar Vahab" },
    created_at: `2026-09-1${seq % 10}T08:00:00Z`,
    updated_at: `2026-09-1${seq % 10}T09:00:00Z`,
    whatsapp_message: null,
    service_required: null,
    location: null,
    site_visit_date: null,
    quotation_amount: null,
    job_value: null,
    ...overrides,
  };
}

let fuSeq = 0;
function followUp(leadId: string, dueDate: string, overrides: Partial<TodayFollowUp> = {}): TodayFollowUp {
  fuSeq += 1;
  return { id: `fu-${fuSeq}`, lead_id: leadId, type: "call", due_date: dueDate, due_time: null, notes: null, ...overrides };
}

const ids = (items: { leadId: string | null }[]) => items.map((i) => i.leadId);

// Derives the SAME canonical DutyItem[] getMyDutyQueue() would produce for
// this leads/follow-ups world, using the real buildDutyItems() (lib/duty.ts)
// -- not a reimplementation. This is what proves buildTodayBoard() actually
// delegates classification rather than re-deriving it: every test below
// feeds Today only the follow-up-derived facts a real caller would have
// already turned into DutyItem[] via getMyDutyQueue(), exactly as
// app/(app)/today/page.tsx does.
function deriveDutyItems(leads: TodayLead[], followUps: TodayFollowUp[], today: string): DutyItem[] {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const leadIdsWithPendingFollowUp = new Set(followUps.map((f) => f.lead_id));

  // Mirrors getPendingFollowUpsWithLead(): a follow-up on a missing or
  // closed lead never reaches buildDutyItems.
  const pendingFollowUps: DutyFollowUpWithLead[] = followUps.flatMap((f) => {
    const l = leadById.get(f.lead_id);
    if (!l || !OPEN_LEAD_STATUSES.includes(l.status)) return [];
    return [{
      id: f.id,
      lead_id: f.lead_id,
      type: f.type,
      due_date: f.due_date,
      due_time: f.due_time,
      notes: f.notes,
      lead: { customer_name: l.customer_name, phone: l.phone, status: l.status, assigned: l.assigned },
    }];
  });

  const uncontactedLeads = leads
    .filter((l) => l.status === "new" && !leadIdsWithPendingFollowUp.has(l.id))
    .map(
      (l) =>
        ({ id: l.id, customer_name: l.customer_name, phone: l.phone, status: l.status, created_at: l.created_at, assigned: l.assigned }) as unknown as UncontactedLead,
    );

  const noFollowUpLeads: DutyLeadWithoutFollowUp[] = leads
    .filter((l) => OPEN_LEAD_STATUSES.includes(l.status) && l.status !== "new" && !leadIdsWithPendingFollowUp.has(l.id))
    .map((l) => ({ id: l.id, customer_name: l.customer_name, phone: l.phone, status: l.status, created_at: l.created_at, assigned: l.assigned }));

  return buildDutyItems({
    pendingFollowUps,
    uncontactedLeads,
    noFollowUpLeads,
    unanswered: [],
    today,
  });
}

// Thin wrapper: derives dutyItems the same way app/(app)/today/page.tsx's
// real getMyDutyQueue() call would, then runs buildTodayBoard(). Individual
// tests can still pass an explicit `dutyItems` override (e.g. to prove
// unanswered-conversation routing, or that Today follows the canonical
// classification rather than recomputing it).
function board(input: { leads: TodayLead[]; followUps: TodayFollowUp[]; today: string; dutyItems?: DutyItem[] }) {
  const dutyItems = input.dutyItems ?? deriveDutyItems(input.leads, input.followUps, input.today);
  return buildTodayBoard({ leads: input.leads, followUps: input.followUps, dutyItems, today: input.today });
}

describe("buildTodayBoard -- site visits use the IST business day (E)", () => {
  it("a visit at 00:30 IST today (previous UTC day) IS today", () => {
    const l = lead({ status: "site_visit", site_visit_date: "2026-09-19T19:00:00Z" }); // 2026-09-20 00:30 IST
    expect(ids(board({ leads: [l], followUps: [], today: TODAY }).siteVisits)).toEqual([l.id]);
  });

  it("a visit at 00:30 IST tomorrow (still today in UTC) is NOT today", () => {
    const l = lead({ status: "site_visit", site_visit_date: "2026-09-20T19:00:00Z" }); // 2026-09-21 00:30 IST
    expect(ids(board({ leads: [l], followUps: [], today: TODAY }).siteVisits)).toEqual([]);
  });

  it("H: follow-up due_date matching is unchanged (plain date strings)", () => {
    const l = lead({ status: "contacted" });
    const b = board({ leads: [l], followUps: [followUp(l.id, TODAY, { due_time: "10:30:00" })], today: TODAY });
    expect(ids(b.dueToday)).toEqual([l.id]);
  });
});

describe("buildTodayBoard -- each section", () => {
  it("Overdue: an open lead with a pending follow-up before today", () => {
    const l = lead({ status: "contacted" });
    const b = board({ leads: [l], followUps: [followUp(l.id, YESTERDAY)], today: TODAY });

    expect(ids(b.overdue)).toEqual([l.id]);
    expect(b.overdue[0].kind).toBe("overdue");
    expect(b.overdue[0].followUp).toMatchObject({ dueDate: YESTERDAY, overdue: true });
    expect(b.total).toBe(1);
  });

  it("Due today: a pending follow-up on today's date; a future-only follow-up appears nowhere", () => {
    const due = lead({ status: "qualified" });
    const later = lead({ status: "qualified" });
    const b = board({
      leads: [due, later],
      followUps: [followUp(due.id, TODAY, { due_time: "10:30:00" }), followUp(later.id, TOMORROW)],
      today: TODAY,
    });

    expect(ids(b.dueToday)).toEqual([due.id]);
    expect(b.dueToday[0].followUp).toMatchObject({ dueTime: "10:30:00", overdue: false });
    expect(b.total).toBe(1); // the tomorrow-only lead needs nothing today
  });

  it("New / uncontacted: a new lead with no pending follow-up (the existing definition)", () => {
    const fresh = lead({ status: "new", whatsapp_message: "Hi, need plastering" });
    const planned = lead({ status: "new" }); // already has a follow-up planned for later
    const b = board({ leads: [fresh, planned], followUps: [followUp(planned.id, TOMORROW)], today: TODAY });

    expect(ids(b.newLeads)).toEqual([fresh.id]);
    expect(b.newLeads[0].kind).toBe("new");
    expect(b.newLeads[0].firstMessage).toBe("Hi, need plastering");
  });

  it("Unanswered: a contacted lead whose only canonical duty is an unanswered conversation", () => {
    const l = lead({ status: "contacted" });
    const dutyItems: DutyItem[] = [
      {
        key: `conversation:conv-1`,
        tier: 3,
        leadId: l.id,
        conversationId: "conv-1",
        followUpId: null,
        customerName: l.customer_name ?? "",
        phone: l.phone,
        stage: null,
        assignedToName: null,
        reasonKind: "unanswered_conversation",
        reasonText: "Customer messaged on WhatsApp and hasn't had a reply yet",
        actionLabel: "Open conversation",
        sortAt: "2026-09-20T03:00:00Z",
      },
    ];
    const b = board({ leads: [l], followUps: [], today: TODAY, dutyItems });

    expect(ids(b.unanswered)).toEqual([l.id]);
    expect(b.unanswered[0].kind).toBe("unanswered");
  });

  it("No follow-up: a qualified (non-deal, non-new) lead with no pending follow-up now appears on Today -- the previously-missing catch-all", () => {
    const stale = lead({ status: "qualified" });
    const b = board({ leads: [stale], followUps: [], today: TODAY });

    expect(ids(b.noFollowUp)).toEqual([stale.id]);
    expect(b.noFollowUp[0].kind).toBe("no_follow_up");
  });

  it("Site visits: only visits whose calendar day is today, only for open leads", () => {
    const today = lead({ status: "site_visit", site_visit_date: `${TODAY}T10:00:00Z`, location: "Kollam" });
    const past = lead({ status: "site_visit", site_visit_date: `${YESTERDAY}T10:00:00Z` });
    const future = lead({ status: "site_visit", site_visit_date: `${TOMORROW}T10:00:00Z` });
    const won = lead({ status: "won", site_visit_date: `${TODAY}T11:00:00Z` });
    const b = board({ leads: [today, past, future, won], followUps: [], today: TODAY });

    expect(ids(b.siteVisits)).toEqual([today.id]);
    expect(b.siteVisits[0]).toMatchObject({ kind: "site_visit", location: "Kollam" });
  });

  it("Quotation attention: a follow-up due/overdue OR none scheduled -- but not a future follow-up", () => {
    const overdue = lead({ status: "quotation", quotation_amount: 250000 });
    const dueToday = lead({ status: "quotation" });
    const stalled = lead({ status: "quotation" }); // no pending follow-up at all
    const healthy = lead({ status: "quotation" }); // has a follow-up next week
    const b = board({
      leads: [overdue, dueToday, stalled, healthy],
      followUps: [followUp(overdue.id, YESTERDAY), followUp(dueToday.id, TODAY), followUp(healthy.id, "2026-09-28")],
      today: TODAY,
    });

    expect(b.quotations.map((i) => [i.leadId, i.kind])).toEqual([
      [overdue.id, "overdue"],
      [dueToday.id, "due_today"],
      [stalled.id, "no_follow_up"],
    ]);
    expect(b.quotations[0].quotationAmount).toBe(250000);
  });

  it("Negotiation attention follows the same rule and lands in its own section", () => {
    const due = lead({ status: "negotiation", job_value: 900000 });
    const stalled = lead({ status: "negotiation" });
    const b = board({ leads: [due, stalled], followUps: [followUp(due.id, TODAY)], today: TODAY });

    expect(b.negotiations.map((i) => [i.leadId, i.kind])).toEqual([
      [due.id, "due_today"],
      [stalled.id, "no_follow_up"],
    ]);
    expect(b.quotations).toEqual([]);
  });

  it("a quotation-stage lead whose canonical duty is 'unanswered' goes to the Unanswered section, not Quotations -- urgency beats stage grouping", () => {
    const l = lead({ status: "quotation" });
    const dutyItems: DutyItem[] = [
      {
        key: `conversation:conv-2`,
        tier: 3,
        leadId: l.id,
        conversationId: "conv-2",
        followUpId: null,
        customerName: l.customer_name ?? "",
        phone: l.phone,
        stage: "quotation",
        assignedToName: null,
        reasonKind: "unanswered_conversation",
        reasonText: "Customer messaged on WhatsApp and hasn't had a reply yet",
        actionLabel: "Open conversation",
        sortAt: "2026-09-20T03:00:00Z",
      },
    ];
    const b = board({ leads: [l], followUps: [], today: TODAY, dutyItems });

    expect(ids(b.unanswered)).toEqual([l.id]);
    expect(b.quotations).toEqual([]);
  });
});

describe("buildTodayBoard -- one lead, one place", () => {
  it("a lead with a site visit today AND an overdue follow-up appears once, under Site visits, carrying the follow-up as context", () => {
    const l = lead({ status: "site_visit", site_visit_date: `${TODAY}T09:00:00Z` });
    const b = board({ leads: [l], followUps: [followUp(l.id, YESTERDAY)], today: TODAY });

    expect(ids(b.siteVisits)).toEqual([l.id]);
    expect(b.siteVisits[0].followUp).toMatchObject({ overdue: true });
    expect(b.overdue).toEqual([]);
    expect(b.total).toBe(1);
  });

  it("a quotation/negotiation lead with an overdue follow-up appears in its deal section, not also under Overdue", () => {
    const q = lead({ status: "quotation" });
    const n = lead({ status: "negotiation" });
    const b = board({ leads: [q, n], followUps: [followUp(q.id, YESTERDAY), followUp(n.id, YESTERDAY)], today: TODAY });

    expect(ids(b.quotations)).toEqual([q.id]);
    expect(ids(b.negotiations)).toEqual([n.id]);
    expect(b.overdue).toEqual([]);
  });

  it("a new lead with a follow-up due today appears under Due today, not also under New", () => {
    const l = lead({ status: "new" });
    const b = board({ leads: [l], followUps: [followUp(l.id, TODAY)], today: TODAY });

    expect(ids(b.dueToday)).toEqual([l.id]);
    expect(b.newLeads).toEqual([]);
  });

  it("with several pending follow-ups on one lead, the earliest overdue one is the context and the lead is listed once", () => {
    const l = lead({ status: "contacted" });
    const b = board({
      leads: [l],
      followUps: [followUp(l.id, TODAY), followUp(l.id, "2026-09-10"), followUp(l.id, YESTERDAY)],
      today: TODAY,
    });

    expect(ids(b.overdue)).toEqual([l.id]);
    expect(b.overdue[0].followUp?.dueDate).toBe("2026-09-10");
    expect(b.dueToday).toEqual([]);
  });
});

describe("buildTodayBoard -- delegates classification to the canonical DutyItem[] input (E: no second Duty definition)", () => {
  it("follows whatever dutyItems says even when the raw follow-ups would suggest something else if recomputed locally", () => {
    const l = lead({ status: "contacted" });
    // Raw follow-up data alone would suggest "overdue" if Today recomputed
    // it -- but the canonical duty passed in says "no_follow_up" (e.g. the
    // follow-up was just completed a moment after getMyDutyQueue() ran).
    // Today must follow the canonical classification, not the raw dates.
    const dutyItems: DutyItem[] = [
      {
        key: `no_follow_up:${l.id}`,
        tier: 5,
        leadId: l.id,
        conversationId: null,
        followUpId: null,
        customerName: l.customer_name ?? "",
        phone: l.phone,
        stage: "contacted",
        assignedToName: null,
        reasonKind: "no_follow_up",
        reasonText: "No follow-up has been scheduled for this lead",
        actionLabel: "Open lead",
        sortAt: l.created_at,
      },
    ];
    const b = board({ leads: [l], followUps: [followUp(l.id, YESTERDAY)], today: TODAY, dutyItems });

    expect(ids(b.noFollowUp)).toEqual([l.id]);
    expect(b.overdue).toEqual([]); // NOT independently re-derived as overdue from the raw follow-up
  });

  it("a lead absent from dutyItems never appears in any duty section, even with a stale pending follow-up in the raw data", () => {
    const l = lead({ status: "contacted" });
    const b = board({ leads: [l], followUps: [followUp(l.id, YESTERDAY)], today: TODAY, dutyItems: [] });

    expect(b.overdue).toEqual([]);
    expect(b.dueToday).toEqual([]);
    expect(b.unanswered).toEqual([]);
    expect(b.newLeads).toEqual([]);
    expect(b.noFollowUp).toEqual([]);
    expect(b.total).toBe(0);
  });
});

describe("buildTodayBoard -- site visit is independent of canonical Duty (H)", () => {
  it("a lead with a site visit today but NO canonical duty at all still appears under Site visits", () => {
    const l = lead({ status: "site_visit", site_visit_date: `${TODAY}T10:00:00Z` });
    const b = board({ leads: [l], followUps: [], today: TODAY, dutyItems: [] });

    expect(ids(b.siteVisits)).toEqual([l.id]);
    expect(b.total).toBe(1);
  });
});

describe("buildTodayBoard -- exclusions and visibility", () => {
  it("never surfaces closed leads, even with a stale pending follow-up or a site visit today", () => {
    const won = lead({ status: "won", site_visit_date: `${TODAY}T10:00:00Z` });
    const lost = lead({ status: "lost" });
    const invalid = lead({ status: "invalid" });
    const b = board({
      leads: [won, lost, invalid],
      followUps: [followUp(won.id, YESTERDAY), followUp(lost.id, TODAY), followUp(invalid.id, YESTERDAY)],
      today: TODAY,
    });

    expect(b.total).toBe(0);
  });

  it("ignores a follow-up whose lead is not in the caller's visible set (staff/RLS scoping is upstream) (G)", () => {
    const mine = lead({ status: "contacted" });
    const b = board({
      leads: [mine],
      followUps: [followUp("someone-elses-lead", YESTERDAY), followUp(mine.id, TODAY)],
      today: TODAY,
    });

    expect(ids(b.overdue)).toEqual([]);
    expect(ids(b.dueToday)).toEqual([mine.id]);
  });

  it("an empty world yields an empty board (drives the empty states)", () => {
    const b = board({ leads: [], followUps: [], today: TODAY });

    expect(b).toEqual({
      overdue: [],
      dueToday: [],
      unanswered: [],
      newLeads: [],
      siteVisits: [],
      quotations: [],
      negotiations: [],
      noFollowUp: [],
      total: 0,
    });
  });

  it("passes the lead's service_required through to the item unchanged (display only)", () => {
    const withService = lead({ status: "new", service_required: "Gypsum Plaster" });
    const without = lead({ status: "new", service_required: null });
    const b = board({ leads: [withService, without], followUps: [], today: TODAY });

    const byId = Object.fromEntries(b.newLeads.map((i) => [i.leadId, i.serviceRequired]));
    expect(byId[withService.id]).toBe("Gypsum Plaster");
    expect(byId[without.id]).toBeNull();
  });

  it("carries the assignee name (null when unassigned) and falls back to a placeholder name", () => {
    const l = lead({ status: "new", customer_name: null, assigned: null });
    const b = board({ leads: [l], followUps: [], today: TODAY });

    expect(b.newLeads[0]).toMatchObject({ customerName: "Unnamed lead", assignedToName: null });
  });
});

describe("buildTodayBoard -- ordering", () => {
  it("Overdue: oldest due date first; Due today: timed before untimed, earliest first", () => {
    const a = lead({ status: "contacted" });
    const b2 = lead({ status: "contacted" });
    const c = lead({ status: "contacted" });
    const overdue = board({
      leads: [a, b2],
      followUps: [followUp(a.id, YESTERDAY), followUp(b2.id, "2026-09-05")],
      today: TODAY,
    });
    expect(ids(overdue.overdue)).toEqual([b2.id, a.id]);

    const today = board({
      leads: [a, b2, c],
      followUps: [
        followUp(a.id, TODAY), // untimed
        followUp(b2.id, TODAY, { due_time: "15:00:00" }),
        followUp(c.id, TODAY, { due_time: "09:00:00" }),
      ],
      today: TODAY,
    });
    expect(ids(today.dueToday)).toEqual([c.id, b2.id, a.id]);
  });

  it("New leads: longest waiting first. Site visits: earliest time first", () => {
    const newer = lead({ status: "new", created_at: "2026-09-19T10:00:00Z" });
    const older = lead({ status: "new", created_at: "2026-09-18T10:00:00Z" });
    expect(ids(board({ leads: [newer, older], followUps: [], today: TODAY }).newLeads)).toEqual([older.id, newer.id]);

    const late = lead({ status: "site_visit", site_visit_date: `${TODAY}T16:00:00Z` });
    const early = lead({ status: "site_visit", site_visit_date: `${TODAY}T09:00:00Z` });
    expect(ids(board({ leads: [late, early], followUps: [], today: TODAY }).siteVisits)).toEqual([early.id, late.id]);
  });

  it("Deals: overdue, then due today, then stalled (least recently updated first)", () => {
    const stalledOld = lead({ status: "quotation", updated_at: "2026-09-01T00:00:00Z" });
    const stalledNew = lead({ status: "quotation", updated_at: "2026-09-15T00:00:00Z" });
    const dueToday = lead({ status: "quotation" });
    const overdue = lead({ status: "quotation" });
    const b = board({
      leads: [stalledNew, dueToday, stalledOld, overdue],
      followUps: [followUp(dueToday.id, TODAY), followUp(overdue.id, YESTERDAY)],
      today: TODAY,
    });

    expect(ids(b.quotations)).toEqual([overdue.id, dueToday.id, stalledOld.id, stalledNew.id]);
  });
});

function duty(overrides: Partial<DutyItem> & Pick<DutyItem, "reasonKind">): DutyItem {
  return {
    key: `duty:${overrides.leadId ?? overrides.conversationId}`,
    tier: 1,
    leadId: null,
    conversationId: null,
    followUpId: null,
    customerName: "Duty Customer",
    phone: "+919111111111",
    stage: null,
    assignedToName: "Azhar Vahab",
    reasonText: "reason",
    actionLabel: "Open",
    sortAt: "2026-09-18T08:00:00Z",
    ...overrides,
  };
}

describe("buildTodayBoard -- every canonical duty has a presentation path (Phase 2, issue 1)", () => {
  it("a canonical duty whose lead is MISSING from the secondary getLeads({}) result still renders from the duty's own fields", () => {
    const d = duty({
      reasonKind: "overdue_follow_up",
      leadId: "lead-not-in-getLeads",
      followUpId: "fu-not-fetched",
      customerName: "Only In Duty",
      stage: "contacted",
      reasonText: "Call overdue since 19 Sep 2026",
      sortAt: YESTERDAY,
    });
    const b = buildTodayBoard({ leads: [], followUps: [], dutyItems: [d], today: TODAY });

    expect(ids(b.overdue)).toEqual(["lead-not-in-getLeads"]);
    expect(b.overdue[0]).toMatchObject({
      customerName: "Only In Duty",
      stage: "contacted",
      phone: "+919111111111",
      assignedToName: "Azhar Vahab",
      dutyReasonKind: "overdue_follow_up",
      dutyReasonText: "Call overdue since 19 Sep 2026",
      followUp: null,
    });
    expect(b.total).toBe(1);
  });

  it("a missing lead is still stage-routed using the duty's own stage (Quotation duty lands in Quotations)", () => {
    const d = duty({ reasonKind: "no_follow_up", leadId: "q-missing", stage: "quotation" });
    const b = buildTodayBoard({ leads: [], followUps: [], dutyItems: [d], today: TODAY });

    expect(ids(b.quotations)).toEqual(["q-missing"]);
    expect(b.noFollowUp).toEqual([]);
  });

  it("with no site visits involved, the number of rendered items always equals the number of canonical duties", () => {
    const l = lead({ status: "contacted" });
    const dutyItems = [
      duty({ reasonKind: "overdue_follow_up", leadId: l.id, stage: "contacted" }),
      duty({ reasonKind: "due_today_follow_up", leadId: "missing-a", stage: "qualified" }),
      duty({ reasonKind: "unanswered_conversation", leadId: "missing-b", conversationId: "conv-b" }),
      duty({ reasonKind: "uncontacted_lead", leadId: "missing-c", stage: "new" }),
      duty({ reasonKind: "no_follow_up", leadId: "missing-d", stage: "negotiation" }),
      duty({ reasonKind: "unanswered_conversation", conversationId: "conv-no-lead" }),
    ];
    const b = buildTodayBoard({ leads: [l], followUps: [], dutyItems, today: TODAY });

    expect(b.total).toBe(dutyItems.length);
  });
});

describe("buildTodayBoard -- lead-less unanswered conversation (Phase 2, issue 2)", () => {
  it("is presented under Unanswered, identified by its conversation, with no lead and no stage", () => {
    const d = duty({ reasonKind: "unanswered_conversation", conversationId: "conv-orphan", customerName: "919222222222", phone: "919222222222" });
    const b = buildTodayBoard({ leads: [], followUps: [], dutyItems: [d], today: TODAY });

    expect(b.unanswered).toHaveLength(1);
    expect(b.unanswered[0]).toMatchObject({
      leadId: null,
      conversationId: "conv-orphan",
      stage: null,
      kind: "unanswered",
      customerName: "919222222222",
    });
    expect(b.total).toBe(1);
  });

  it("two lead-less unanswered conversations both render with distinct keys (never deduped, same as lib/duty.ts)", () => {
    const b = buildTodayBoard({
      leads: [],
      followUps: [],
      dutyItems: [
        duty({ reasonKind: "unanswered_conversation", conversationId: "c1", key: "conversation:c1" }),
        duty({ reasonKind: "unanswered_conversation", conversationId: "c2", key: "conversation:c2" }),
      ],
      today: TODAY,
    });

    expect(b.unanswered.map((i) => i.conversationId)).toEqual(["c1", "c2"]);
    expect(new Set(b.unanswered.map((i) => i.key)).size).toBe(2);
  });
});

describe("Site visit today is a Today presentation rule, not a Duty priority (Phase 2, issue 3)", () => {
  it("the canonical duty still exists for a site-visit-today lead, and Today carries it on the Site visits item", () => {
    const l = lead({ status: "site_visit", site_visit_date: `${TODAY}T09:00:00Z` });
    const followUps = [followUp(l.id, YESTERDAY)];
    const dutyItems = deriveDutyItems([l], followUps, TODAY);

    // Canonical Duty is unaffected by the site visit: lib/duty.ts knows
    // nothing about site_visit_date.
    expect(dutyItems.map((d) => [d.leadId, d.reasonKind])).toEqual([[l.id, "overdue_follow_up"]]);

    const b = buildTodayBoard({ leads: [l], followUps, dutyItems, today: TODAY });
    expect(ids(b.siteVisits)).toEqual([l.id]);
    expect(b.siteVisits[0]).toMatchObject({ kind: "site_visit", dutyReasonKind: "overdue_follow_up" });
    expect(b.overdue).toEqual([]); // shown once -- display precedence only
    expect(b.total).toBe(1);
  });

  it("canonical priority is unchanged by site visits: overdue > due today > unanswered > uncontacted > no follow-up", () => {
    const visit = { site_visit_date: `${TODAY}T09:00:00Z` };
    const overdueLead = lead({ status: "contacted", ...visit });
    const dueLead = lead({ status: "contacted", ...visit });
    const unansweredLead = lead({ status: "contacted" });
    const newLead = lead({ status: "new", ...visit });
    const staleLead = lead({ status: "qualified", ...visit });
    const leads = [staleLead, newLead, unansweredLead, dueLead, overdueLead];
    const followUps = [followUp(overdueLead.id, YESTERDAY), followUp(dueLead.id, TODAY)];
    const asDutyLead = (l: TodayLead) => ({ customer_name: l.customer_name, phone: l.phone, status: l.status, assigned: l.assigned });

    const dutyItems = buildDutyItems({
      pendingFollowUps: [
        { ...followUps[0], lead: asDutyLead(overdueLead) },
        { ...followUps[1], lead: asDutyLead(dueLead) },
      ],
      unanswered: [
        // the overdue lead is ALSO unanswered -- overdue must still win
        { id: "conv-o", wa_id: overdueLead.phone, lastInboundAt: "2026-09-20T01:00:00Z", lead: { id: overdueLead.id, customer_name: overdueLead.customer_name, assigned: null } },
        { id: "conv-u", wa_id: unansweredLead.phone, lastInboundAt: "2026-09-20T01:00:00Z", lead: { id: unansweredLead.id, customer_name: unansweredLead.customer_name, assigned: null } },
      ],
      uncontactedLeads: [{ id: newLead.id, customer_name: newLead.customer_name, phone: newLead.phone, status: "new", created_at: newLead.created_at, assigned: null } as unknown as UncontactedLead],
      noFollowUpLeads: [{ id: staleLead.id, customer_name: staleLead.customer_name, phone: staleLead.phone, status: "qualified", created_at: staleLead.created_at, assigned: null }],
      today: TODAY,
    });

    expect(dutyItems.map((d) => [d.leadId, d.reasonKind])).toEqual([
      [overdueLead.id, "overdue_follow_up"],
      [dueLead.id, "due_today_follow_up"],
      [unansweredLead.id, "unanswered_conversation"],
      [newLead.id, "uncontacted_lead"],
      [staleLead.id, "no_follow_up"],
    ]);

    // Today: the four site-visit leads are spotlighted, each still carrying
    // its own canonical duty; the one without a visit stays in its duty section.
    const b = buildTodayBoard({ leads, followUps, dutyItems, today: TODAY });
    expect(Object.fromEntries(b.siteVisits.map((i) => [i.leadId, i.dutyReasonKind]))).toEqual({
      [overdueLead.id]: "overdue_follow_up",
      [dueLead.id]: "due_today_follow_up",
      [newLead.id]: "uncontacted_lead",
      [staleLead.id]: "no_follow_up",
    });
    expect(ids(b.unanswered)).toEqual([unansweredLead.id]);
    expect(b.total).toBe(5);
  });
});
