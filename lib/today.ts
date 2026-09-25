import type { LeadListRow } from "@/lib/leads";
import type { FollowUpRow, LeadStatus } from "@/lib/supabase/types";
import type { DutyItem, DutyReasonKind } from "@/lib/duty";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";
import { businessDateOf } from "@/lib/business-time";

// The "Today" sales command center's classification -- a pure function over
// data the app already fetches: getLeads({}), getFollowUps({status:
// "pending"}), and getMyDutyQueue() (lib/dashboard-brain.ts). All three
// already apply the existing visibility rules (admin sees everything,
// staff only their own assigned leads/follow-ups/duties, backed by RLS), so
// this module adds no new query, no new field and no permission logic of
// its own.
//
// Duty Architecture Audit (2026-09) Phase 2: this used to independently
// re-derive "does this lead need attention, and why" from the raw leads/
// follow-ups arrays -- a second, competing definition of Duty that silently
// disagreed with lib/dashboard-brain.ts's getMyDutyQueue() (missing the
// unanswered-conversation signal entirely, and missing the "no follow-up"
// catch-all for a contacted/qualified lead with nothing scheduled). It no
// longer does either. `dutyItems` -- getMyDutyQueue()'s own deduped,
// tier-sorted DutyItem[] -- is now REQUIRED input and is the only source of
// "which of the five canonical signals applies to this lead, if any".
//
// Every canonical duty has a presentation path. The board is built by
// walking `dutyItems` itself, not by walking the leads list and looking
// duties up -- so a duty whose lead is missing from the secondary
// getLeads({}) result (a query/timing mismatch) still renders from the
// duty's own fields, and an unanswered conversation not yet linked to any
// lead renders too, linking to its conversation (same as the Dashboard's
// DutyList). `leads` and `followUps` are display enrichment only (service,
// location, amounts, first message, the matched follow-up's type/time/
// notes); they never decide whether a duty is shown.
//
// This module only adds genuinely Today-specific presentation on top:
//   * grouping canonical duties into the day's sections
//   * routing a canonical duty for a Quotation/Negotiation-stage lead into
//     its own deal section (an existing, legitimate Today-only grouping
//     rule, not a new Duty signal)
//   * Site visits today -- a PRESENTATION spotlight, not a Duty signal and
//     not a Duty priority (see lib/duty.ts). It is sourced directly from
//     leads.site_visit_date; a lead can appear here with zero canonical duty.
//     When a site-visit lead also has a canonical duty, the lead is shown
//     once, under Site visits, and the duty is carried on that item
//     (`dutyReasonKind`, plus the follow-up context) -- the canonical duty
//     itself is untouched, and its priority stays exactly as lib/duty.ts
//     defines it: overdue > due today > unanswered > uncontacted > no
//     follow-up.
//
// One lead, one place: a lead appears in exactly ONE section (the site-visit
// spotlight takes precedence as a display rule; a Quotation/Negotiation-stage
// lead's follow-up-related duty is grouped into its deal section rather
// than the generic Overdue/Due-today/No-follow-up sections -- an
// unanswered-conversation or uncontacted-lead duty is never stage-routed,
// since "no one has replied" or "no one has called" is urgent regardless
// of pipeline stage).

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

export type TodayItemKind = "overdue" | "due_today" | "unanswered" | "new" | "site_visit" | "no_follow_up";

export type TodayItem = {
  key: string;
  // null only for an unanswered conversation not yet linked to a lead --
  // that item links to its conversation instead of Lead Detail.
  leadId: string | null;
  conversationId: string | null;
  customerName: string;
  phone: string | null;
  // null when the canonical duty carries no stage and no lead record is
  // available to supply one (e.g. a lead-less unanswered conversation).
  stage: LeadStatus | null;
  assignedToName: string | null;
  kind: TodayItemKind;
  // The canonical duty for this lead (lib/duty.ts), if any. For every
  // section except Site visits this is what put the item there; on a
  // site-visit item it is carried as context only.
  dutyReasonKind: DutyReasonKind | null;
  dutyReasonText: string | null;
  // Display detail for the matched follow-up, when the canonical duty for
  // this lead is follow-up-related. Never used to decide overdue/due-today
  // itself -- that decision already happened in lib/duty.ts.
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
  unanswered: TodayItem[];
  newLeads: TodayItem[];
  siteVisits: TodayItem[];
  quotations: TodayItem[];
  negotiations: TodayItem[];
  noFollowUp: TodayItem[];
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

const DUTY_KIND_TO_TODAY_KIND: Record<DutyReasonKind, Exclude<TodayItemKind, "site_visit">> = {
  overdue_follow_up: "overdue",
  due_today_follow_up: "due_today",
  unanswered_conversation: "unanswered",
  uncontacted_lead: "new",
  no_follow_up: "no_follow_up",
};

export function buildTodayBoard(input: {
  leads: TodayLead[];
  followUps: TodayFollowUp[];
  dutyItems: DutyItem[];
  today: string;
}): TodayBoard {
  const { today, dutyItems } = input;

  // Enrichment lookups only -- never a gate on whether a duty is shown.
  const leadById = new Map(input.leads.map((lead) => [lead.id, lead]));
  const followUpById = new Map(input.followUps.map((f) => [f.id, f]));

  // The canonical classification per lead id (already deduped and
  // tier-resolved by lib/duty.ts).
  const dutyByLead = new Map<string, DutyItem>();
  for (const duty of dutyItems) {
    if (duty.leadId) dutyByLead.set(duty.leadId, duty);
  }

  const board: TodayBoard = {
    overdue: [],
    dueToday: [],
    unanswered: [],
    newLeads: [],
    siteVisits: [],
    quotations: [],
    negotiations: [],
    noFollowUp: [],
    total: 0,
  };

  // Builds one item from an optional lead record and an optional canonical
  // duty. Duty fields are the fallback for anything the lead record would
  // otherwise supply, so a duty never needs a lead record to render.
  const item = (kind: TodayItemKind, lead: TodayLead | null, duty: DutyItem | null): TodayItem => {
    const matched = duty?.followUpId ? (followUpById.get(duty.followUpId) ?? null) : null;
    const leadId = lead?.id ?? duty?.leadId ?? null;
    return {
      key: `${kind}:${leadId ?? duty?.key}`,
      leadId,
      conversationId: duty?.conversationId ?? null,
      customerName: lead ? lead.customer_name || "Unnamed lead" : (duty?.customerName ?? "Unnamed lead"),
      phone: lead?.phone ?? duty?.phone ?? null,
      stage: lead?.status ?? duty?.stage ?? null,
      assignedToName: lead ? (lead.assigned?.display_name ?? null) : (duty?.assignedToName ?? null),
      kind,
      dutyReasonKind: duty?.reasonKind ?? null,
      dutyReasonText: duty?.reasonText ?? null,
      followUp: matched
        ? {
            type: matched.type,
            dueDate: matched.due_date,
            dueTime: matched.due_time,
            notes: matched.notes,
            overdue: matched.due_date < today,
          }
        : null,
      siteVisitAt: lead?.site_visit_date ?? null,
      location: lead?.location ?? null,
      quotationAmount: lead?.quotation_amount ?? null,
      jobValue: lead?.job_value ?? null,
      serviceRequired: lead?.service_required ?? null,
      firstMessage: lead?.whatsapp_message ?? null,
      createdAt: lead?.created_at ?? duty?.sortAt ?? "",
      updatedAt: lead?.updated_at ?? duty?.sortAt ?? "",
    };
  };

  // 1. Site visits today -- presentation spotlight, open leads only. A lead
  // shown here is not shown again in a duty section; its canonical duty (if
  // any) rides along on the item.
  const spotlighted = new Set<string>();
  for (const lead of input.leads) {
    if (!OPEN_LEAD_STATUSES.includes(lead.status)) continue;
    if (lead.site_visit_date === null || businessDateOf(lead.site_visit_date) !== today) continue;
    board.siteVisits.push(item("site_visit", lead, dutyByLead.get(lead.id) ?? null));
    spotlighted.add(lead.id);
  }

  // 2. Every canonical duty, in canonical order. Nothing here filters a duty
  // out except the site-visit spotlight above (which still shows the lead).
  for (const duty of dutyItems) {
    if (duty.leadId && spotlighted.has(duty.leadId)) continue;

    const lead = duty.leadId ? (leadById.get(duty.leadId) ?? null) : null;
    const todayKind = DUTY_KIND_TO_TODAY_KIND[duty.reasonKind];
    const stage = lead?.status ?? duty.stage;
    const isDealStage = stage === "quotation" || stage === "negotiation";
    // "Unanswered" and "New" stay in their own signal-based section
    // regardless of pipeline stage -- an unreplied message or an uncalled
    // lead is urgent on its own terms, not something to bury inside a deal
    // section. Follow-up-related and no-follow-up duties on a Quotation/
    // Negotiation-stage lead route into that lead's deal section instead of
    // the generic sections -- the same grouping rule this page already had.
    if (isDealStage && (todayKind === "overdue" || todayKind === "due_today" || todayKind === "no_follow_up")) {
      (stage === "quotation" ? board.quotations : board.negotiations).push(item(todayKind, lead, duty));
      continue;
    }

    const section = {
      overdue: board.overdue,
      due_today: board.dueToday,
      unanswered: board.unanswered,
      new: board.newLeads,
      no_follow_up: board.noFollowUp,
    }[todayKind];
    section.push(item(todayKind, lead, duty));
  }

  // Ordering within each section: most urgent / longest waiting first.
  const dueKey = (i: TodayItem): DueKey => ({ due_date: i.followUp?.dueDate ?? "", due_time: i.followUp?.dueTime ?? null });
  const followUpOrder = (a: TodayItem, b: TodayItem) => compareFollowUps(dueKey(a), dueKey(b));
  const attentionRank: Record<TodayItemKind, number> = { overdue: 0, due_today: 1, no_follow_up: 2, unanswered: 3, new: 3, site_visit: 4 };

  board.overdue.sort(followUpOrder);
  board.dueToday.sort(followUpOrder);
  board.unanswered.sort((a, b) => byTime(a.updatedAt, b.updatedAt)); // longest waiting first
  board.newLeads.sort((a, b) => byTime(a.createdAt, b.createdAt)); // oldest waiting first
  board.noFollowUp.sort((a, b) => byTime(a.updatedAt, b.updatedAt)); // stalest first
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
    board.unanswered.length +
    board.newLeads.length +
    board.siteVisits.length +
    board.quotations.length +
    board.negotiations.length +
    board.noFollowUp.length;

  return board;
}
