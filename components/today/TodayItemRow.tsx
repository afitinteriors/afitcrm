import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatRelative, telLink, whatsappLink } from "@/lib/format";
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

// Icon-only contact actions. Same helpers and link behavior as DoThisNowCard
// and Lead Detail (tel: for calls, wa.me in a new tab for WhatsApp) -- only the
// presentation is new. The label lives in aria-label/title, and the two icons
// have clearly different shapes, so the action never depends on color alone.
const ICON_BUTTON =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9 lg:w-9";

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px] text-success" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// The whole row is the Lead Detail link: the customer name is a real,
// keyboard-focusable <Link> whose ::after stretches over the row (the
// "stretched link" pattern), so there is one link, valid markup, and a
// visible focus ring around the entire row. The contact icons sit above that
// overlay (relative z-10), so tapping Call or WhatsApp performs only that
// action and never opens Lead Detail -- no click handlers or propagation
// tricks needed. Destination is unchanged: /leads/<id>.
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
    <li
      className="group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary"
      data-testid="today-item"
      data-lead-id={item.leadId}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/leads/${item.leadId}`}
            className="truncate text-sm font-semibold text-foreground after:absolute after:inset-0 after:content-[] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {item.customerName}
          </Link>
          <StatusBadge status={item.stage} />
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-foreground/80">{context}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.phone}
          {showAssignee && <span> · {item.assignedToName ?? "Unassigned"}</span>}
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-2">
        {item.phone && (
          <a href={telLink(item.phone)} aria-label="Call customer" title="Call customer" className={ICON_BUTTON}>
            <PhoneIcon />
          </a>
        )}
        {item.phone && (
          <a
            href={whatsappLink(item.phone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp customer"
            title="WhatsApp customer"
            className={ICON_BUTTON}
          >
            <WhatsAppIcon />
          </a>
        )}
      </div>

      <span className="hidden shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground lg:block">
        <ChevronIcon />
      </span>
    </li>
  );
}
