import { describe, it, expect } from "vitest";
import { buildTodayBoard, type TodayFollowUp, type TodayLead } from "@/lib/today";

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

const ids = (items: { leadId: string }[]) => items.map((i) => i.leadId);

describe("buildTodayBoard -- each section", () => {
  it("Overdue: an open lead with a pending follow-up before today", () => {
    const l = lead({ status: "contacted" });
    const board = buildTodayBoard({ leads: [l], followUps: [followUp(l.id, YESTERDAY)], today: TODAY });

    expect(ids(board.overdue)).toEqual([l.id]);
    expect(board.overdue[0].kind).toBe("overdue");
    expect(board.overdue[0].followUp).toMatchObject({ dueDate: YESTERDAY, overdue: true });
    expect(board.total).toBe(1);
  });

  it("Due today: a pending follow-up on today's date; a future-only follow-up appears nowhere", () => {
    const due = lead({ status: "qualified" });
    const later = lead({ status: "qualified" });
    const board = buildTodayBoard({
      leads: [due, later],
      followUps: [followUp(due.id, TODAY, { due_time: "10:30:00" }), followUp(later.id, TOMORROW)],
      today: TODAY,
    });

    expect(ids(board.dueToday)).toEqual([due.id]);
    expect(board.dueToday[0].followUp).toMatchObject({ dueTime: "10:30:00", overdue: false });
    expect(board.total).toBe(1); // the tomorrow-only lead needs nothing today
  });

  it("New / uncontacted: a new lead with no pending follow-up (the existing definition)", () => {
    const fresh = lead({ status: "new", whatsapp_message: "Hi, need plastering" });
    const planned = lead({ status: "new" }); // already has a follow-up planned for later
    const board = buildTodayBoard({ leads: [fresh, planned], followUps: [followUp(planned.id, TOMORROW)], today: TODAY });

    expect(ids(board.newLeads)).toEqual([fresh.id]);
    expect(board.newLeads[0].kind).toBe("new");
    expect(board.newLeads[0].firstMessage).toBe("Hi, need plastering");
  });

  it("Site visits: only visits whose calendar day is today, only for open leads", () => {
    const today = lead({ status: "site_visit", site_visit_date: `${TODAY}T10:00:00Z`, location: "Kollam" });
    const past = lead({ status: "site_visit", site_visit_date: `${YESTERDAY}T10:00:00Z` });
    const future = lead({ status: "site_visit", site_visit_date: `${TOMORROW}T10:00:00Z` });
    const won = lead({ status: "won", site_visit_date: `${TODAY}T11:00:00Z` });
    const board = buildTodayBoard({ leads: [today, past, future, won], followUps: [], today: TODAY });

    expect(ids(board.siteVisits)).toEqual([today.id]);
    expect(board.siteVisits[0]).toMatchObject({ kind: "site_visit", location: "Kollam" });
  });

  it("Quotation attention: a follow-up due/overdue OR none scheduled -- but not a future follow-up", () => {
    const overdue = lead({ status: "quotation", quotation_amount: 250000 });
    const dueToday = lead({ status: "quotation" });
    const stalled = lead({ status: "quotation" }); // no pending follow-up at all
    const healthy = lead({ status: "quotation" }); // has a follow-up next week
    const board = buildTodayBoard({
      leads: [overdue, dueToday, stalled, healthy],
      followUps: [followUp(overdue.id, YESTERDAY), followUp(dueToday.id, TODAY), followUp(healthy.id, "2026-09-28")],
      today: TODAY,
    });

    expect(board.quotations.map((i) => [i.leadId, i.kind])).toEqual([
      [overdue.id, "overdue"],
      [dueToday.id, "due_today"],
      [stalled.id, "no_follow_up"],
    ]);
    expect(board.quotations[0].quotationAmount).toBe(250000);
  });

  it("Negotiation attention follows the same rule and lands in its own section", () => {
    const due = lead({ status: "negotiation", job_value: 900000 });
    const stalled = lead({ status: "negotiation" });
    const board = buildTodayBoard({ leads: [due, stalled], followUps: [followUp(due.id, TODAY)], today: TODAY });

    expect(board.negotiations.map((i) => [i.leadId, i.kind])).toEqual([
      [due.id, "due_today"],
      [stalled.id, "no_follow_up"],
    ]);
    expect(board.quotations).toEqual([]);
  });
});

describe("buildTodayBoard -- one lead, one place", () => {
  it("a lead with a site visit today AND an overdue follow-up appears once, under Site visits, carrying the follow-up as context", () => {
    const l = lead({ status: "site_visit", site_visit_date: `${TODAY}T09:00:00Z` });
    const board = buildTodayBoard({ leads: [l], followUps: [followUp(l.id, YESTERDAY)], today: TODAY });

    expect(ids(board.siteVisits)).toEqual([l.id]);
    expect(board.siteVisits[0].followUp).toMatchObject({ overdue: true });
    expect(board.overdue).toEqual([]);
    expect(board.total).toBe(1);
  });

  it("a quotation/negotiation lead with an overdue follow-up appears in its deal section, not also under Overdue", () => {
    const q = lead({ status: "quotation" });
    const n = lead({ status: "negotiation" });
    const board = buildTodayBoard({ leads: [q, n], followUps: [followUp(q.id, YESTERDAY), followUp(n.id, YESTERDAY)], today: TODAY });

    expect(ids(board.quotations)).toEqual([q.id]);
    expect(ids(board.negotiations)).toEqual([n.id]);
    expect(board.overdue).toEqual([]);
  });

  it("a new lead with a follow-up due today appears under Due today, not also under New", () => {
    const l = lead({ status: "new" });
    const board = buildTodayBoard({ leads: [l], followUps: [followUp(l.id, TODAY)], today: TODAY });

    expect(ids(board.dueToday)).toEqual([l.id]);
    expect(board.newLeads).toEqual([]);
  });

  it("with several pending follow-ups on one lead, the earliest overdue one is the context and the lead is listed once", () => {
    const l = lead({ status: "contacted" });
    const board = buildTodayBoard({
      leads: [l],
      followUps: [followUp(l.id, TODAY), followUp(l.id, "2026-09-10"), followUp(l.id, YESTERDAY)],
      today: TODAY,
    });

    expect(ids(board.overdue)).toEqual([l.id]);
    expect(board.overdue[0].followUp?.dueDate).toBe("2026-09-10");
    expect(board.dueToday).toEqual([]);
  });
});

describe("buildTodayBoard -- exclusions and visibility", () => {
  it("never surfaces closed leads, even with a stale pending follow-up or a site visit today", () => {
    const won = lead({ status: "won", site_visit_date: `${TODAY}T10:00:00Z` });
    const lost = lead({ status: "lost" });
    const invalid = lead({ status: "invalid" });
    const board = buildTodayBoard({
      leads: [won, lost, invalid],
      followUps: [followUp(won.id, YESTERDAY), followUp(lost.id, TODAY), followUp(invalid.id, YESTERDAY)],
      today: TODAY,
    });

    expect(board.total).toBe(0);
  });

  it("ignores a follow-up whose lead is not in the caller's visible set (staff/RLS scoping is upstream)", () => {
    const mine = lead({ status: "contacted" });
    const board = buildTodayBoard({
      leads: [mine],
      followUps: [followUp("someone-elses-lead", YESTERDAY), followUp(mine.id, TODAY)],
      today: TODAY,
    });

    expect(ids(board.overdue)).toEqual([]);
    expect(ids(board.dueToday)).toEqual([mine.id]);
  });

  it("an empty world yields an empty board (drives the empty states)", () => {
    const board = buildTodayBoard({ leads: [], followUps: [], today: TODAY });

    expect(board).toEqual({
      overdue: [],
      dueToday: [],
      newLeads: [],
      siteVisits: [],
      quotations: [],
      negotiations: [],
      total: 0,
    });
  });

  it("passes the lead's service_required through to the item unchanged (display only)", () => {
    const withService = lead({ status: "new", service_required: "Gypsum Plaster" });
    const without = lead({ status: "new", service_required: null });
    const board = buildTodayBoard({ leads: [withService, without], followUps: [], today: TODAY });

    const byId = Object.fromEntries(board.newLeads.map((i) => [i.leadId, i.serviceRequired]));
    expect(byId[withService.id]).toBe("Gypsum Plaster");
    expect(byId[without.id]).toBeNull();
  });

  it("carries the assignee name (null when unassigned) and falls back to a placeholder name", () => {
    const l = lead({ status: "new", customer_name: null, assigned: null });
    const board = buildTodayBoard({ leads: [l], followUps: [], today: TODAY });

    expect(board.newLeads[0]).toMatchObject({ customerName: "Unnamed lead", assignedToName: null });
  });
});

describe("buildTodayBoard -- ordering", () => {
  it("Overdue: oldest due date first; Due today: timed before untimed, earliest first", () => {
    const a = lead({ status: "contacted" });
    const b = lead({ status: "contacted" });
    const c = lead({ status: "contacted" });
    const overdue = buildTodayBoard({
      leads: [a, b],
      followUps: [followUp(a.id, YESTERDAY), followUp(b.id, "2026-09-05")],
      today: TODAY,
    });
    expect(ids(overdue.overdue)).toEqual([b.id, a.id]);

    const today = buildTodayBoard({
      leads: [a, b, c],
      followUps: [
        followUp(a.id, TODAY), // untimed
        followUp(b.id, TODAY, { due_time: "15:00:00" }),
        followUp(c.id, TODAY, { due_time: "09:00:00" }),
      ],
      today: TODAY,
    });
    expect(ids(today.dueToday)).toEqual([c.id, b.id, a.id]);
  });

  it("New leads: longest waiting first. Site visits: earliest time first", () => {
    const newer = lead({ status: "new", created_at: "2026-09-19T10:00:00Z" });
    const older = lead({ status: "new", created_at: "2026-09-18T10:00:00Z" });
    expect(ids(buildTodayBoard({ leads: [newer, older], followUps: [], today: TODAY }).newLeads)).toEqual([older.id, newer.id]);

    const late = lead({ status: "site_visit", site_visit_date: `${TODAY}T16:00:00Z` });
    const early = lead({ status: "site_visit", site_visit_date: `${TODAY}T09:00:00Z` });
    expect(ids(buildTodayBoard({ leads: [late, early], followUps: [], today: TODAY }).siteVisits)).toEqual([early.id, late.id]);
  });

  it("Deals: overdue, then due today, then stalled (least recently updated first)", () => {
    const stalledOld = lead({ status: "quotation", updated_at: "2026-09-01T00:00:00Z" });
    const stalledNew = lead({ status: "quotation", updated_at: "2026-09-15T00:00:00Z" });
    const dueToday = lead({ status: "quotation" });
    const overdue = lead({ status: "quotation" });
    const board = buildTodayBoard({
      leads: [stalledNew, dueToday, stalledOld, overdue],
      followUps: [followUp(dueToday.id, TODAY), followUp(overdue.id, YESTERDAY)],
      today: TODAY,
    });

    expect(ids(board.quotations)).toEqual([overdue.id, dueToday.id, stalledOld.id, stalledNew.id]);
  });
});
