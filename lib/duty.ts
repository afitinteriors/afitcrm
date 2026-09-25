import type { LeadStatus } from "@/lib/supabase/types";
import type { UnansweredConversation } from "@/lib/conversations";
import type { UncontactedLead } from "@/lib/leads";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

// Duty Architecture Audit (2026-09) Phase 2 -- the ONE canonical Duty
// derivation. Previously this logic lived inline inside
// lib/dashboard-brain.ts's getMyDutyQueue() and lib/today.ts independently
// re-derived an overlapping-but-different notion of "needs attention" from
// scratch (buildTodayBoard()). Both now consume this module: dashboard-
// brain.ts calls buildDutyItems() with the raw signals it already fetches
// and layers counts on top; lib/today.ts takes the resulting DutyItem[] as
// an input and only adds Today-specific presentation (day-window grouping,
// the separate non-Duty site-visit-today spotlight) -- it does not
// recompute overdue/due-today/unanswered/uncontacted/no-follow-up itself.
//
// Four raw signals, five priority outcomes (overdue and due-today are both
// "a scheduled follow-up", split by date):
//   1. Follow-up due / overdue        -> overdue_follow_up | due_today_follow_up
//   2. Inbound WhatsApp unanswered    -> unanswered_conversation
//   3. Brand-new enquiry uncontacted  -> uncontacted_lead
//   4. Open, non-new, no next step    -> no_follow_up
// Only (1) has a real due date -- the other three are open-ended until
// their underlying fact resolves (a reply is sent, first contact is made,
// a follow-up gets scheduled). This module makes no ownership/visibility
// decision itself -- callers already pass in data their own RLS-scoped
// queries produced (staff sees only their own leads, admin sees
// everything), same convention as the rest of this project.

export type DutyReasonKind =
  | "overdue_follow_up"
  | "due_today_follow_up"
  | "unanswered_conversation"
  | "uncontacted_lead"
  | "no_follow_up";

export type DutyItem = {
  key: string;
  tier: number;
  leadId: string | null;
  conversationId: string | null;
  followUpId: string | null;
  customerName: string;
  phone: string | null;
  stage: LeadStatus | null;
  assignedToName: string | null;
  reasonKind: DutyReasonKind;
  reasonText: string;
  actionLabel: string;
  sortAt: string; // ISO timestamp/date used to order items within a tier
};

// The one deterministic priority rule: overdue first, then due today, then
// the other MUST-HAVE attention signals in a fixed order so the result is
// always reproducible from the same data. An ordering rule over existing
// facts, not a score -- no numeric weight is assigned to any signal.
export const DUTY_TIER = {
  OVERDUE_FOLLOW_UP: 1,
  DUE_TODAY_FOLLOW_UP: 2,
  UNANSWERED_CONVERSATION: 3,
  UNCONTACTED_LEAD: 4,
  NO_FOLLOW_UP: 5,
} as const;

export type DutyFollowUpWithLead = {
  id: string;
  lead_id: string;
  type: string;
  due_date: string;
  due_time: string | null;
  notes: string | null;
  lead: { customer_name: string | null; phone: string; status: LeadStatus; assigned: { display_name: string | null } | null } | null;
};

export type DutyLeadWithoutFollowUp = {
  id: string;
  customer_name: string | null;
  phone: string;
  status: LeadStatus;
  created_at: string;
  assigned: { display_name: string | null } | null;
};

export type DutySignals = {
  // Every pending follow-up the caller can see (any due date). Filtering to
  // overdue/due-today happens inside buildDutyItems, against `today`.
  pendingFollowUps: DutyFollowUpWithLead[];
  unanswered: UnansweredConversation[];
  // Already the caller's final "new, no pending follow-up" set -- i.e. any
  // exclusion for leads that already have a pending follow-up elsewhere
  // must happen before calling this (same rule dashboard-brain.ts already
  // applied: a lead with a follow-up scheduled has a real next step and
  // must not also show as bare "uncontacted").
  uncontactedLeads: UncontactedLead[];
  // Open, non-new leads with no pending follow-up at all.
  noFollowUpLeads: DutyLeadWithoutFollowUp[];
  today: string; // business-zone (IST) calendar day, e.g. from businessDate()
};

// The canonical winning-duty-per-lead derivation: builds one DutyItem per
// raw signal, tier-sorts, then keeps only the highest-tier (most urgent)
// item per lead id -- a lead that trips more than one signal at once (the
// everyday shape of a fresh WhatsApp enquiry: simultaneously "unanswered"
// and "uncontacted") is shown exactly once, under its most urgent reason.
// Items with no leadId (an unanswered conversation not yet linked to any
// lead) are never deduped against anything else.
export function buildDutyItems(signals: DutySignals): DutyItem[] {
  const { pendingFollowUps, unanswered, uncontactedLeads, noFollowUpLeads, today } = signals;

  const items: DutyItem[] = [];

  for (const f of pendingFollowUps) {
    if (!f.lead) continue;
    const overdue = f.due_date < today;
    const dueToday = f.due_date === today;
    if (!overdue && !dueToday) continue; // upcoming follow-ups aren't part of the attention queue itself
    items.push({
      key: `follow_up:${f.id}`,
      tier: overdue ? DUTY_TIER.OVERDUE_FOLLOW_UP : DUTY_TIER.DUE_TODAY_FOLLOW_UP,
      leadId: f.lead_id,
      conversationId: null,
      followUpId: f.id,
      customerName: f.lead.customer_name || "Unnamed lead",
      phone: f.lead.phone,
      stage: f.lead.status,
      assignedToName: f.lead.assigned?.display_name ?? null,
      reasonKind: overdue ? "overdue_follow_up" : "due_today_follow_up",
      reasonText: overdue
        ? `${FOLLOW_UP_TYPE_LABELS[f.type as keyof typeof FOLLOW_UP_TYPE_LABELS] ?? "Follow-up"} overdue since ${formatDate(f.due_date)}`
        : `${FOLLOW_UP_TYPE_LABELS[f.type as keyof typeof FOLLOW_UP_TYPE_LABELS] ?? "Follow-up"} due today`,
      actionLabel: "Complete follow-up",
      sortAt: f.due_date,
    });
  }

  for (const c of unanswered) {
    items.push({
      key: `conversation:${c.id}`,
      tier: DUTY_TIER.UNANSWERED_CONVERSATION,
      leadId: c.lead?.id ?? null,
      conversationId: c.id,
      followUpId: null,
      customerName: c.lead?.customer_name || c.wa_id,
      phone: c.wa_id,
      stage: null,
      assignedToName: c.lead?.assigned?.display_name ?? null,
      reasonKind: "unanswered_conversation",
      reasonText: "Customer messaged on WhatsApp and hasn't had a reply yet",
      actionLabel: "Open conversation",
      sortAt: c.lastInboundAt,
    });
  }

  for (const lead of uncontactedLeads) {
    items.push({
      key: `uncontacted:${lead.id}`,
      tier: DUTY_TIER.UNCONTACTED_LEAD,
      leadId: lead.id,
      conversationId: null,
      followUpId: null,
      customerName: lead.customer_name || "Unnamed lead",
      phone: lead.phone,
      stage: lead.status,
      assignedToName: lead.assigned?.display_name ?? null,
      reasonKind: "uncontacted_lead",
      reasonText: "New enquiry -- needs first contact",
      actionLabel: "Call customer",
      sortAt: lead.created_at,
    });
  }

  for (const lead of noFollowUpLeads) {
    items.push({
      key: `no_follow_up:${lead.id}`,
      tier: DUTY_TIER.NO_FOLLOW_UP,
      leadId: lead.id,
      conversationId: null,
      followUpId: null,
      customerName: lead.customer_name || "Unnamed lead",
      phone: lead.phone,
      stage: lead.status,
      assignedToName: lead.assigned?.display_name ?? null,
      reasonKind: "no_follow_up",
      reasonText: "No follow-up has been scheduled for this lead",
      actionLabel: "Open lead",
      sortAt: lead.created_at,
    });
  }

  items.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime()));

  const seenLeadIds = new Set<string>();
  return items.filter((item) => {
    if (!item.leadId) return true;
    if (seenLeadIds.has(item.leadId)) return false;
    seenLeadIds.add(item.leadId);
    return true;
  });
}
