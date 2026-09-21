import { formatCurrency, formatRelative } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";
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

// Mobile counterpart to LeadRow -- the same card as the Today list (shared
// pieces in lead-card-parts), not a squeezed table. The customer name is the
// stretched link to Lead Detail; Call / WhatsApp sit above it and never
// navigate. `showAssignee` is admin-only, matching /today.
export function LeadCard({ lead, showAssignee }: { lead: LeadListRow; showAssignee: boolean }) {
  // Won's actual closed value takes precedence once it exists (see
  // leads/[id]/page.tsx) -- keeps this card consistent with Lead Detail.
  const value = lead.job_value ?? lead.quotation_amount;
  const name = lead.customer_name || "Unnamed lead";

  return (
    <li className={leadCardClass(lead.status)} data-testid="lead-card" data-lead-id={lead.id}>
      <LeadAvatar leadId={lead.id} name={name} />

      <div className="[grid-area:1/2/2/3] min-w-0">
        <div className="flex flex-col items-start gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-2">
          <LeadNameLink leadId={lead.id} name={name} />
          <StageBadge stage={lead.status} />
        </div>
      </div>

      <LeadContactActions phone={lead.phone} />
      <LeadChevron />

      <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-foreground/80 [grid-area:2/1/3/4] lg:mt-0 lg:[grid-area:2/2/3/3]">
        <Glyph d={ICON.clock} className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span>
          Received {formatRelative(lead.created_at)}
          {value !== null && <span className="font-semibold tabular-nums"> · {formatCurrency(value)}</span>}
        </span>
      </p>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 self-end text-xs text-muted-foreground [grid-area:3/1/4/3] lg:self-center lg:[grid-area:3/2/4/3]">
        <span className="inline-flex items-center gap-1">
          <Glyph d={ICON.phone} className="h-3 w-3 shrink-0" />
          {lead.phone}
        </span>
        {(lead.service_required || lead.project_type) && (
          <span className="inline-flex items-center gap-1 font-medium text-foreground/70">
            <Glyph d={ICON.tag} className="h-3 w-3 shrink-0" />
            {lead.service_required || lead.project_type}
          </span>
        )}
        {showAssignee && (
          <span className="inline-flex items-center gap-1">
            <Glyph d={ICON.user} className="h-3 w-3 shrink-0" />
            {lead.assigned?.display_name || "Unassigned"}
          </span>
        )}
      </p>
    </li>
  );
}
