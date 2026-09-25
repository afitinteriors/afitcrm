import Link from "next/link";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import {
  ICON,
  Glyph,
  LeadAvatar,
  LeadChevron,
  LeadContactActions,
  LeadNameLink,
  StageBadge,
  leadCardClass,
} from "@/components/lead-card-parts";
import type { TodayItem, TodayItemKind } from "@/lib/today";

// "new" has no chip: the stage badge already says "New" and the section title
// says "New / uncontacted", so a second "New" pill beside it is pure noise.
const KIND_BADGE: Record<TodayItemKind, { label: string; className: string } | null> = {
  overdue: { label: "Overdue", className: "bg-danger-soft text-danger" },
  due_today: { label: "Due today", className: "bg-warning-soft text-warning" },
  unanswered: { label: "Unanswered", className: "bg-warning-soft text-warning" },
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
      // The matched follow-up row is display enrichment; if it isn't in the
      // secondary follow-ups fetch, the canonical duty's own text still says why.
      return `${item.followUp ? followUpText(item.followUp) : (item.dutyReasonText ?? "Follow-up")}${notes}`;
    case "unanswered":
      return "Customer messaged on WhatsApp and hasn't had a reply yet";
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
        : (item.dutyReasonText ?? "Follow-up");
  return [money, state, `updated ${formatRelative(item.updatedAt)}`].filter(Boolean).join(" · ");
}

function reasonIcon(item: TodayItem, variant: "default" | "deal"): string {
  if (variant === "deal") return ICON.doc;
  switch (item.kind) {
    case "overdue":
    case "due_today":
      return ICON.clock;
    case "site_visit":
      return ICON.pin;
    case "no_follow_up":
      return ICON.doc;
    case "unanswered":
    case "new":
      return ICON.chat;
  }
}

// Each lead is its own rounded card with a pastel left accent and an initials
// avatar. The whole card is the Lead Detail link: the customer name is a real,
// keyboard-focusable <Link> whose ::after stretches over the card (the
// "stretched link" pattern), so there is one link, valid markup, and a visible
// focus ring that follows the card's shape. The contact icons sit above that
// overlay (relative z-10), so tapping Call or WhatsApp performs only that
// action and never opens Lead Detail. Destination is unchanged: /leads/<id>.
//
// Layout: a grid so the same markup reflows without a second design. On a
// phone the avatar, name and action icons share the first line and the
// details use the full width beneath; from lg up, the details sit beside the
// avatar and the actions centre vertically, keeping the card compact.
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
    // A lead-less item (an unanswered conversation not yet linked to a lead)
    // has no stage: it takes the neutral slate accent and shows no stage badge.
    <li className={leadCardClass(item.stage ?? "invalid")} data-testid="today-item" data-lead-id={item.leadId ?? undefined}>
      <LeadAvatar leadId={item.leadId ?? item.key} name={item.customerName} />

      <div className="[grid-area:1/2/2/3] min-w-0">
        <div className="flex flex-col items-start gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-2">
          {item.leadId ? (
            <LeadNameLink leadId={item.leadId} name={item.customerName} />
          ) : (
            // Same stretched-link treatment as LeadNameLink, pointed at the
            // conversation -- the same destination the Dashboard's DutyList uses.
            <Link
              href={`/conversations/${item.conversationId}`}
              className="min-w-0 max-w-full break-words text-base font-semibold leading-snug text-foreground after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {item.customerName}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {item.stage && <StageBadge stage={item.stage} />}
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
            )}
          </div>
        </div>
      </div>

      <LeadContactActions phone={item.phone} />
      <LeadChevron />

      <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-foreground/80 [grid-area:2/1/3/4] lg:mt-0 lg:[grid-area:2/2/3/3]">
        <Glyph d={reasonIcon(item, variant)} className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>{context}</span>
      </p>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 self-end text-xs text-muted-foreground [grid-area:3/1/4/3] lg:self-center lg:[grid-area:3/2/4/3]">
        {item.phone && (
          <span className="inline-flex items-center gap-1">
            <Glyph d={ICON.phone} className="h-3 w-3 shrink-0" />
            {item.phone}
          </span>
        )}
        {item.serviceRequired && (
          <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
            <Glyph d={ICON.tag} className="h-3 w-3 shrink-0" />
            {item.serviceRequired}
          </span>
        )}
        {showAssignee && (
          <span className="inline-flex items-center gap-1">
            <Glyph d={ICON.user} className="h-3 w-3 shrink-0" />
            {item.assignedToName ?? "Unassigned"}
          </span>
        )}
      </p>
    </li>
  );
}
