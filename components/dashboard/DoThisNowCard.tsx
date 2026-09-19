import Link from "next/link";
import type { DutyItem } from "@/lib/dashboard-brain";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";
import { telLink, whatsappLink } from "@/lib/format";
import { LEAD_STATUS_LABELS } from "@/lib/constants";

const REASON_TONE: Record<DutyItem["reasonKind"], "danger" | "warning" | "accent" | "neutral"> = {
  overdue_follow_up: "danger",
  due_today_follow_up: "warning",
  unanswered_conversation: "warning",
  uncontacted_lead: "accent",
  no_follow_up: "neutral",
};

const TONE_CLASSES: Record<"danger" | "warning" | "accent" | "neutral", { border: string; badge: string }> = {
  danger: { border: "border-l-danger", badge: "bg-danger-soft text-danger" },
  warning: { border: "border-l-warning", badge: "bg-warning-soft text-warning" },
  accent: { border: "border-l-accent", badge: "bg-accent/15 text-accent-foreground" },
  neutral: { border: "border-l-border", badge: "bg-muted text-muted-foreground" },
};

// The single dominant "what do I do right now" card -- the one piece of the
// V6.6 audit's "Do This Now" concept this phase actually adopts. The
// selection itself (which item is #1) is lib/dashboard-brain.ts's
// deterministic tier sort; this component only presents it and explains why
// it was picked -- no score, no invented urgency language.
export function DoThisNowCard({ item }: { item: DutyItem | null }) {
  if (!item) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Duty Now</p>
        <p className="mt-2 text-sm font-medium text-foreground">Nothing needs your attention right now.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No overdue action, no unanswered message, and every active lead has a follow-up scheduled.
        </p>
      </div>
    );
  }

  const tone = REASON_TONE[item.reasonKind];
  const { border, badge } = TONE_CLASSES[tone];
  const leadHref = item.leadId ? `/leads/${item.leadId}` : null;
  const conversationHref = item.conversationId ? `/conversations/${item.conversationId}` : null;

  return (
    <div className={`rounded-xl border border-border border-l-4 bg-card p-5 shadow-sm ${border}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My Duty Now</p>
        {item.stage && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge}`}>{LEAD_STATUS_LABELS[item.stage]}</span>
        )}
      </div>

      <h2 className="mt-2 text-lg font-semibold text-foreground">{item.customerName}</h2>
      {item.assignedToName && <p className="text-xs text-muted-foreground">Assigned to {item.assignedToName}</p>}

      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Reason: </span>
        {item.reasonText}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.phone && (
          <a
            href={telLink(item.phone)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Call
          </a>
        )}
        {item.phone && (
          <a
            href={whatsappLink(item.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            WhatsApp
          </a>
        )}
        {conversationHref && (
          <Link
            href={conversationHref}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Conversation
          </Link>
        )}
        {item.followUpId && item.leadId && (
          <CompleteFollowUpButton followUpId={item.followUpId} leadId={item.leadId} />
        )}
        {leadHref && (
          <Link
            href={leadHref}
            className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium ${
              conversationHref
                ? "border border-border bg-secondary text-foreground hover:bg-muted"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            Open Lead
          </Link>
        )}
      </div>
    </div>
  );
}
