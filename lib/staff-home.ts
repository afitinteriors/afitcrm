import type { DutyItem } from "@/lib/duty";
import type { LeadStatus } from "@/lib/supabase/types";

// Staff Home -- a pure grouping of the canonical, already-deduped DutyItem[]
// (getMyDutyQueue() -> lib/duty.ts buildDutyItems()) into the three things a
// salesperson needs to know: is there a new lead, who needs a follow-up now,
// who needs one today. It derives no signal of its own -- which item a lead
// gets, and its priority, is decided entirely upstream; each lead arrives
// here exactly once. `leads`/`followUps` are display enrichment only
// (service, stage, due time) and never decide whether an item is shown.
//
// One mapping rule is worth spelling out: a brand-new WhatsApp enquiry is
// simultaneously "unanswered" and "uncontacted", and canonical priority
// resolves it to "unanswered". For a lead still at the New stage (or a
// conversation not yet linked to any lead) that is still, to a salesperson,
// a new lead -- so it is grouped under New leads, not hidden elsewhere.

export type StaffHomeTone = "new" | "now" | "today" | "other";

export type StaffHomeItem = {
  key: string;
  leadId: string | null;
  conversationId: string | null;
  customerName: string;
  phone: string | null;
  serviceRequired: string | null;
  stage: LeadStatus | null;
  statusLabel: string;
  tone: StaffHomeTone;
  // ISO date of the follow-up for follow-up items; null otherwise.
  dueDate: string | null;
  dueTime: string | null;
  createdAt: string;
};

export type StaffHomeBoard = {
  newLeads: StaffHomeItem[];
  followUpNow: StaffHomeItem[];
  followUpToday: StaffHomeItem[];
  other: StaffHomeItem[];
};

export type StaffHomeLead = {
  id: string;
  status: LeadStatus;
  service_required: string | null;
  created_at: string;
};

export type StaffHomeFollowUp = { id: string; due_date: string; due_time: string | null };

export function buildStaffHome(input: {
  dutyItems: DutyItem[];
  leads: StaffHomeLead[];
  followUps: StaffHomeFollowUp[];
}): StaffHomeBoard {
  const leadById = new Map(input.leads.map((l) => [l.id, l]));
  const followUpById = new Map(input.followUps.map((f) => [f.id, f]));

  const board: StaffHomeBoard = { newLeads: [], followUpNow: [], followUpToday: [], other: [] };

  for (const duty of input.dutyItems) {
    const lead = duty.leadId ? (leadById.get(duty.leadId) ?? null) : null;
    const stage = lead?.status ?? duty.stage;
    const followUp = duty.followUpId ? (followUpById.get(duty.followUpId) ?? null) : null;

    const base = {
      key: duty.key,
      leadId: duty.leadId,
      conversationId: duty.conversationId,
      customerName: duty.customerName,
      phone: duty.phone,
      serviceRequired: lead?.service_required ?? null,
      stage,
      dueDate: null as string | null,
      dueTime: null as string | null,
      createdAt: lead?.created_at ?? duty.sortAt,
    };

    switch (duty.reasonKind) {
      case "overdue_follow_up":
        board.followUpNow.push({
          ...base,
          statusLabel: "Follow-up overdue",
          tone: "now",
          dueDate: followUp?.due_date ?? duty.sortAt,
          dueTime: followUp?.due_time ?? null,
        });
        break;
      case "due_today_follow_up":
        board.followUpToday.push({
          ...base,
          statusLabel: "Follow-up today",
          tone: "today",
          dueDate: followUp?.due_date ?? duty.sortAt,
          dueTime: followUp?.due_time ?? null,
        });
        break;
      case "uncontacted_lead":
        board.newLeads.push({ ...base, statusLabel: "New lead", tone: "new" });
        break;
      case "unanswered_conversation":
        if (!duty.leadId || stage === "new" || stage === null) {
          board.newLeads.push({ ...base, statusLabel: "New lead · messaged you", tone: "new" });
        } else {
          board.other.push({ ...base, statusLabel: "Customer replied", tone: "other" });
        }
        break;
      case "no_follow_up":
        board.other.push({ ...base, statusLabel: "No next action", tone: "other" });
        break;
    }
  }

  const byDue = (a: StaffHomeItem, b: StaffHomeItem) => {
    if (a.dueDate !== b.dueDate) return (a.dueDate ?? "") < (b.dueDate ?? "") ? -1 : 1;
    const at = a.dueTime ?? "99:99:99"; // untimed after timed on the same day
    const bt = b.dueTime ?? "99:99:99";
    return at < bt ? -1 : at > bt ? 1 : 0;
  };
  board.newLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // newest first
  board.followUpNow.sort(byDue); // most overdue first
  board.followUpToday.sort(byDue); // earliest time first
  // `other` keeps canonical order (replied before no-next-action, oldest first).

  return board;
}
