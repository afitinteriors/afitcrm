import Link from "next/link";
import { telLink, whatsappLink, formatRelative } from "@/lib/format";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { avatarFor, initialsFor, Glyph, ICON } from "@/components/lead-card-parts";
import type { StaffHomeItem, StaffHomeTone } from "@/lib/staff-home";

const PILL_CLASSES: Record<StaffHomeTone, string> = {
  now: "bg-danger-soft text-danger",
  today: "bg-warning-soft text-warning",
  new: "bg-blue-50 text-blue-700",
  other: "bg-muted text-muted-foreground",
};

// "Overdue 2 days" / "Due today" -- built only from real due_date/due_time,
// no invented copy.
function pillText(item: StaffHomeItem): string {
  if (item.tone === "now" && item.dueDate) {
    const days = Math.max(1, Math.round((Date.now() - new Date(item.dueDate).getTime()) / 86_400_000));
    return `Overdue ${days} day${days === 1 ? "" : "s"}`;
  }
  if (item.tone === "today") return "Due today";
  if (item.tone === "new") return "New";
  return item.statusLabel;
}

// Self-contained card for the Staff Dashboard's Follow up now/today/New
// leads lists -- deliberately does not reuse leadCardClass/LeadAvatar's
// exact markup from lead-card-parts.tsx (only its safe presentational
// helpers: avatarFor/initialsFor/Glyph/ICON), so this redesign never changes
// the shared card used on /leads and /today.
export function StaffFollowUpCard({ item }: { item: StaffHomeItem }) {
  const initials = initialsFor(item.customerName);
  const href = item.leadId ? `/leads/${item.leadId}` : `/conversations/${item.conversationId}`;

  return (
    <li className="relative flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarFor(item.leadId ?? item.key)}`}
        aria-hidden="true"
      >
        {initials ?? <Glyph d={ICON.user} className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="min-w-0 truncate text-sm font-semibold text-foreground after:absolute after:inset-0 after:content-['']">
            {item.customerName}
          </Link>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PILL_CLASSES[item.tone]}`}>{pillText(item)}</span>
        </div>
        {item.serviceRequired && <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.serviceRequired}</p>}
        {(item.projectType || item.location) && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[item.projectType, item.location].filter(Boolean).join(" • ")}
          </p>
        )}
        {item.tone === "new" && item.source && LEAD_SOURCE_LABELS[item.source] && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            New enquiry from {LEAD_SOURCE_LABELS[item.source]} · {formatRelative(item.createdAt)}
          </p>
        )}
        {item.note && <p className="mt-1 truncate text-sm font-medium text-foreground">{item.note}</p>}

        <div className="relative z-10 mt-2 flex items-center gap-2">
          {item.phone && (
            <a
              href={telLink(item.phone)}
              aria-label="Call customer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100 hover:bg-blue-100"
            >
              <Glyph d={ICON.phone} className="h-4 w-4" />
            </a>
          )}
          {item.phone && (
            <a
              href={whatsappLink(item.phone)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp customer"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100 hover:bg-emerald-100"
            >
              <Glyph d={ICON.chat} className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </li>
  );
}
