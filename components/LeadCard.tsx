import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";

// Mobile counterpart to LeadRow -- not a squeezed table, a dedicated card
// laid out by priority: identity, status, value/service, owner/activity,
// then an explicit "open" affordance. The whole card is one link so the tap
// target is the full card, not just the name.
export function LeadCard({ lead }: { lead: LeadListRow }) {
  // Won's actual closed value takes precedence once it exists (see
  // leads/[id]/page.tsx) -- keeps this card consistent with Lead Detail.
  const value = lead.job_value ?? lead.quotation_amount;

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

          <div className="mt-2 flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-muted-foreground">
              {lead.service_required || lead.project_type || "No service specified"}
            </span>
            {value !== null && (
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatCurrency(value)}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{lead.assigned?.display_name || "Unassigned"}</span>
            <span className="shrink-0">{formatRelative(lead.created_at)}</span>
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
