import Link from "next/link";
import { formatDate, formatRelative } from "@/lib/format";
import { LeadAvatar, LeadChevron, LeadContactActions, LeadNameLink, StageBadge, leadCardClass } from "@/components/lead-card-parts";
import type { StaffHomeItem, StaffHomeTone } from "@/lib/staff-home";

const STATUS_PILL: Record<StaffHomeTone, { pill: string; dot: string }> = {
  new: { pill: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  now: { pill: "bg-danger-soft text-danger ring-danger/20", dot: "bg-danger" },
  today: { pill: "bg-warning-soft text-warning ring-warning/20", dot: "bg-warning" },
  other: { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground/60" },
};

// "since 20 Sep 2026, 10:30" / "at 10:30" / "received 2 hours ago" -- only
// what the salesperson needs to judge urgency, nothing else.
function whenText(item: StaffHomeItem): string | null {
  const time = item.dueTime ? item.dueTime.slice(0, 5) : null;
  if (item.tone === "now" && item.dueDate) return `since ${formatDate(item.dueDate)}${time ? `, ${time}` : ""}`;
  if (item.tone === "today") return time ? `at ${time}` : null;
  if (item.tone === "new") return `received ${formatRelative(item.createdAt)}`;
  return null;
}

// Compact Staff Home card: name, service, stage, one status line, Call and
// WhatsApp. Same stretched-link pattern and shared pieces as the Today and
// Leads cards: the whole card opens Lead Detail, and the contact buttons sit
// above that link so they only ever do their own action. A conversation not
// yet linked to a lead opens that conversation instead.
export function StaffLeadCard({ item }: { item: StaffHomeItem }) {
  const pill = STATUS_PILL[item.tone];
  const when = whenText(item);

  return (
    <li className={leadCardClass(item.stage ?? "invalid")} data-testid="staff-home-card" data-lead-id={item.leadId ?? undefined}>
      <LeadAvatar leadId={item.leadId ?? item.key} name={item.customerName} />

      <div className="min-w-0 [grid-area:1/2/2/3]">
        {item.leadId ? (
          <LeadNameLink leadId={item.leadId} name={item.customerName} />
        ) : (
          <Link
            href={`/conversations/${item.conversationId}`}
            className="min-w-0 max-w-full break-words text-base font-semibold leading-snug text-foreground after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {item.customerName}
          </Link>
        )}
        {item.serviceRequired && <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.serviceRequired}</p>}
      </div>

      <LeadContactActions phone={item.phone} />
      <LeadChevron />

      <div className="flex flex-wrap items-center gap-1.5 [grid-area:2/1/3/3] lg:[grid-area:2/2/3/3]">
        {item.stage && <StageBadge stage={item.stage} />}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${pill.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} aria-hidden="true" />
          {item.statusLabel}
        </span>
      </div>

      {when && <p className="text-xs text-muted-foreground [grid-area:3/1/4/3] lg:[grid-area:3/2/4/3]">{when}</p>}
    </li>
  );
}
