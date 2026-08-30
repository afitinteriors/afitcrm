import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";

// Mobile counterpart to SiteVisitRow -- same card shape as LeadCard.tsx
// (whole-card link, identity + status up top, detail line, owner/date
// footer), swapped to lead the visit date instead of value/service.
export function SiteVisitCard({ lead }: { lead: LeadListRow }) {
  return (
    <li>
      <Link
        href={`/leads/${lead.id}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm active:bg-secondary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
              <p className="text-xs text-muted-foreground">{lead.phone}</p>
            </div>
            <StatusBadge status={lead.status} />
          </div>

          <p className="mt-2 text-xs font-medium text-foreground">{formatDateTime(lead.site_visit_date)}</p>

          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{lead.assigned?.display_name || "Unassigned"}</span>
          </div>
        </div>

        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-muted-foreground"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    </li>
  );
}
