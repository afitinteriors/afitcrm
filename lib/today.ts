import type { LeadListRow } from "@/lib/leads";
import type { FollowUpRow, LeadStatus } from "@/lib/supabase/types";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";
import { businessDateOf } from "@/lib/business-time";

// The "Today" sales command center's classification -- a pure function over
// data the app already fetches (getLeads({}) and getFollowUps({status:
// "pending"})), so it inherits their existing scoping: RLS plus the
// staff-sees-own-assigned filter already in lib/leads.ts. No new query, no
// new field, no new concept: every rule below reuses a signal that already
// exists.
//
//   * Overdue / Due today -- a pending follow_ups row whose due_date is
//     before / equal to today (same comparison as groupFollowUpsByDueDate).
//   * New / uncontacted   -- a lead still at the "new" stage with NO pending
//     follow-up, exactly lib/dashboard-brain.ts's existing definition.
//   * Site visits         -- leads.site_visit_date falling on today (same
//     calendar-day match as the Site Visits page).
//   * Quotation / Negotiation attention -- a lead at that stage that has an
//     overdue or due-today follow-up, or has NO pending follow-up at all
//     (the existing "stalled pipeline" notion). No ageing threshold is
//     invented.
//
// One lead, one place: a lead appears in exactly ONE section, chosen by the
// priority below, so a salesperson never sees the same lead twice. Context
// from a lower-priority signal (e.g. a site-visit lead that also has an
// overdue follow-up) is carried on the item rather than duplicating it.
//   1. Site visit today
//   2. Quotation / Negotiation needing attention
//   3. Overdue follow-up
//   4. Due-today follow-up
//   5. New / uncontacted

export type TodayLead = Pick<
  LeadListRow,
  | "id"
  | "customer_name"
  | "phone"
  | "status"
  | "assigned"
  | "created_at"
  | "updated_at"
  | "whatsapp_message"
  | "service_required"
  | "location"
  | "site_visit_date"
  | "quotation_amount"
  | "job_value"
>;

export type TodayFollowUp = Pick<FollowUpRow, "id" | "lead_id" | "type" | "due_date" | "due_time" | "notes">;

export type TodayItemKind = "overdue" | "due_today" | "new" | "site_visit" | "no_follow_up";

export type TodayItem = {
  key: string;
  leadId: string;
  customerName: string;
  phone: string;
  stage: LeadStatus;
  assignedToName: string | null;
  kind: TodayItemKind;
  // Most urgent actionable (overdue, else due-today) pending follow-up on the
  // lead, if any -- context for every section, the reason for Overdue/Due today.
  followUp: { type: FollowUpRow["type"]; dueDate: string; dueTime: string | null; notes: string | null; overdue: boolean } | null;
  siteVisitAt: string | null;
  location: string | null;
  quotationAmount: number | null;
  jobValue: number | null;
  serviceRequired: string | null;
  firstMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TodayBoard = {
  overdue: TodayItem[];
  dueToday: TodayItem[];
  newLeads: TodayItem[];
  siteVisits: TodayItem[];
  quotations: TodayItem[];
  negotiations: TodayItem[];
  total: number;
};

type DueKey = { due_date: string; due_time: string | null };

function compareFollowUps(a: DueKey, b: DueKey): number {
  if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  const at = a.due_time ?? "99:99:99"; // untimed sorts after timed on the same day
  const bt = b.due_time ?? "99:99:99";
  return at < bt ? -1 : at > bt ? 1 : 0;
}

function byTime(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function buildTodayBoard(input: { leads: TodayLead[]; followUps: TodayFollowUp[]; today: string }): TodayBoard {
  const { today } = input;

  const openLeads = input.leads.filter((lead) => OPEN_LEAD_STATUSES.includes(lead.status));
  const openIds = new Set(openLeads.map((lead) => lead.id));

  // Pending follow-ups grouped per open lead. A follow-up on a lead the
  // caller can't see, or that is closed/merged, is ignored -- it must never
  // generate an item (same rule as lib/dashboard-brain.ts).
  const followUpsByLead = new Map<string, TodayFollowUp[]>();
  for (const followUp of input.followUps) {
    if (!openIds.has(followUp.lead_id)) continue;
    const list = followUpsByLead.get(followUp.lead_id) ?? [];
    list.push(followUp);
    followUpsByLead.set(followUp.lead_id, list);
  }

  const board: TodayBoard = {
    overdue: [],
    dueToday: [],
    newLeads: [],
    siteVisits: [],
    quotations: [],
    negotiations: [],
    total: 0,
  };

  for (const lead of openLeads) {
    const pending = (followUpsByLead.get(lead.id) ?? []).slice().sort(compareFollowUps);
    const overdue = pending.find((f) => f.due_date < today) ?? null;
    const dueToday = pending.find((f) => f.due_date === today) ?? null;
    const actionable = overdue ?? dueToday;
    const hasPending = pending.length > 0;

    const item = (kind: TodayItemKind): TodayItem => ({
      key: `${kind}:${lead.id}`,
      leadId: lead.id,
      customerName: lead.customer_name || "Unnamed lead",
      phone: lead.phone,
      stage: lead.status,
      assignedToName: lead.assigned?.display_name ?? null,
      kind,
      followUp: actionable
        ? {
            type: actionable.type,
            dueDate: actionable.due_date,
            dueTime: actionable.due_time,
            notes: actionable.notes,
            overdue: actionable === overdue,
          }
        : null,
      siteVisitAt: lead.site_visit_date,
      location: lead.location,
      quotationAmount: lead.quotation_amount,
      jobValue: lead.job_value,
      serviceRequired: lead.service_required,
      firstMessage: lead.whatsapp_message,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
    });

    const visitToday = lead.site_visit_date !== null && businessDateOf(lead.site_visit_date) === today;
    const dealNeedsAttention = (lead.status === "quotation" || lead.status === "negotiation") && (actionable !== null || !hasPending);

    if (visitToday) {
      board.siteVisits.push(item("site_visit"));
    } else if (dealNeedsAttention) {
      const kind: TodayItemKind = overdue ? "overdue" : dueToday ? "due_today" : "no_follow_up";
      (lead.status === "quotation" ? board.quotations : board.negotiations).push(item(kind));
    } else if (overdue) {
      board.overdue.push(item("overdue"));
    } else if (dueToday) {
      board.dueToday.push(item("due_today"));
    } else if (lead.status === "new" && !hasPending) {
      board.newLeads.push(item("new"));
    }
  }

  // Ordering within each section: most urgent / longest waiting first.
  const dueKey = (i: TodayItem): DueKey => ({ due_date: i.followUp?.dueDate ?? "", due_time: i.followUp?.dueTime ?? null });
  const followUpOrder = (a: TodayItem, b: TodayItem) => compareFollowUps(dueKey(a), dueKey(b));
  const attentionRank: Record<TodayItemKind, number> = { overdue: 0, due_today: 1, no_follow_up: 2, new: 3, site_visit: 4 };

  board.overdue.sort(followUpOrder);
  board.dueToday.sort(followUpOrder);
  board.newLeads.sort((a, b) => byTime(a.createdAt, b.createdAt)); // oldest waiting first
  board.siteVisits.sort((a, b) => byTime(a.siteVisitAt ?? "", b.siteVisitAt ?? ""));
  const dealOrder = (a: TodayItem, b: TodayItem) =>
    attentionRank[a.kind] !== attentionRank[b.kind]
      ? attentionRank[a.kind] - attentionRank[b.kind]
      : a.kind === "no_follow_up"
        ? byTime(a.updatedAt, b.updatedAt) // stalest first
        : followUpOrder(a, b);
  board.quotations.sort(dealOrder);
  board.negotiations.sort(dealOrder);

  board.total =
    board.overdue.length +
    board.dueToday.length +
    board.newLeads.length +
    board.siteVisits.length +
    board.quotations.length +
    board.negotiations.length;

  return board;
}
