import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatRelative, telLink } from "@/lib/format";
import type { TodayItem, TodayItemKind } from "@/lib/today";

// "new" has no chip: the stage badge already says "New" and the section title
// says "New / uncontacted", so a second "New" pill beside it is pure noise.
const KIND_BADGE: Record<TodayItemKind, { label: string; className: string } | null> = {
  overdue: { label: "Overdue", className: "bg-danger-soft text-danger" },
  due_today: { label: "Due today", className: "bg-warning-soft text-warning" },
  new: null,
  site_visit: { label: "Site visit today", className: "bg-accent/15 text-accent-foreground" },
  no_follow_up: { label: "No follow-up", className: "bg-muted text-muted-foreground" },
};

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function followUpText(followUp: NonNullable<TodayItem["followUp"]>): string {
  const label = FOLLOW_UP_TYPE_LABELS[followUp.type] ?? "Follow-up";
  const at = followUp.dueTime ? ` at ${followUp.dueTime.slice(0, 5)}` : "";
  return followUp.overdue ? `${label} overdue since ${formatDate(followUp.dueDate)}${at}` : `${label} due today${at}`;
}

// The one-line "why is this here" shown under the name. Everything is drawn
// from fields the lead/follow-up already carries -- nothing is computed or
// invented here, and no ageing rule is applied.
function contextLine(item: TodayItem): string {
  const notes = item.followUp?.notes ? ` — ${truncate(item.followUp.notes, 80)}` : "";

  switch (item.kind) {
    case "overdue":
    case "due_today":
      return `${item.followUp ? followUpText(item.followUp) : "Follow-up"}${notes}`;
    case "new": {
      const first = item.firstMessage ? ` — “${truncate(item.firstMessage, 90)}”` : "";
      return `New enquiry, received ${formatRelative(item.createdAt)}${first}`;
    }
    case "site_visit": {
      const where = item.location ? ` · ${item.location}` : "";
      const also = item.followUp ? ` · Also: ${followUpText(item.followUp)}` : "";
      return `${formatDateTime(item.siteVisitAt)}${where}${also}`;
    }
    case "no_follow_up":
      return `No follow-up scheduled · updated ${formatRelative(item.updatedAt)}${quoteSummary(item)}`;
  }
}

function quoteSummary(item: TodayItem): string {
  const parts: string[] = [];
  if (item.quotationAmount !== null) parts.push(`Quote ${formatCurrency(item.quotationAmount)}`);
  if (item.jobValue !== null) parts.push(`Job ${formatCurrency(item.jobValue)}`);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
}

// Deal rows (Quotation / Negotiation attention) lead with the money and the
// follow-up state instead of the generic "no follow-up" wording.
function dealContextLine(item: TodayItem): string {
  const money = quoteSummary(item).replace(/^ · /, "");
  const state =
    item.kind === "no_follow_up"
      ? "No follow-up scheduled"
      : item.followUp
        ? `${followUpText(item.followUp)}${item.followUp.notes ? ` — ${truncate(item.followUp.notes, 80)}` : ""}`
        : "Follow-up";
  return [money, state, `updated ${formatRelative(item.updatedAt)}`].filter(Boolean).join(" · ");
}

export function TodayItemRow({
  item,
  showAssignee,
  variant = "default",
}: {
  item: TodayItem;
  showAssignee: boolean;
  variant?: "default" | "deal";
}) {
  const badge = KIND_BADGE[item.kind];
  const context = variant === "deal" ? dealContextLine(item) : contextLine(item);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-testid="today-item" data-lead-id={item.leadId}>
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/leads/${item.leadId}`} className="truncate text-sm font-medium text-foreground hover:underline">
            {item.customerName}
          </Link>
          <StatusBadge status={item.stage} />
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{context}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.phone}
          {showAssignee && <span> · {item.assignedToName ?? "Unassigned"}</span>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {item.phone && (
          <a
            href={telLink(item.phone)}
            className="inline-flex min-h-11 items-center rounded-md border border-border bg-secondary px-3 lg:min-h-9 text-sm font-medium text-foreground hover:bg-muted"
          >
            Call
          </a>
        )}
        <Link
          href={`/leads/${item.leadId}`}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-3 lg:min-h-9 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open lead
        </Link>
      </div>
    </li>
  );
}
