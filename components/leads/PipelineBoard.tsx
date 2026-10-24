import Link from "next/link";
import { PIPELINE_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { avatarFor, initialsFor, Glyph, ICON } from "@/components/lead-card-parts";
import type { LeadListRow } from "@/lib/leads";

// Read-only Kanban-style view over the same leads the list already shows --
// no drag-and-drop (owner decision, docs/strategy/lead-ops-ai-hermes/02 §2):
// every card is tap-to-open only, same as LeadCard. Stage change still only
// happens on Lead Detail, through the existing setLeadStatus/markLeadWon/
// markLeadLost guards -- this view adds no new mutation path. Columns are
// exactly the real 8 PIPELINE_STATUSES; no "Nurture"/"Junk" grouping is
// added since those aren't real statuses and the exact grouping rule for
// them is still [BUSINESS DECISION REQUIRED] per that doc.
export function PipelineBoard({
  leads,
  listQuery,
  showAssignee,
}: {
  leads: LeadListRow[];
  listQuery?: string;
  showAssignee: boolean;
}) {
  const byStage = new Map<string, LeadListRow[]>();
  for (const status of PIPELINE_STATUSES) byStage.set(status, []);
  for (const lead of leads) {
    byStage.get(lead.status)?.push(lead);
  }

  return (
    <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" data-testid="pipeline-board">
      {PIPELINE_STATUSES.map((status) => {
        const columnLeads = byStage.get(status) ?? [];
        const columnValue = columnLeads.reduce((sum, l) => sum + (l.job_value ?? l.quotation_amount ?? 0), 0);
        return (
          <div key={status} className="flex w-72 shrink-0 flex-col rounded-lg border border-white/10 bg-glass backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
              <span className="text-sm font-semibold text-surface-foreground">{LEAD_STATUS_LABELS[status]}</span>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-surface-foreground-muted">
                {columnLeads.length}
              </span>
            </div>
            {columnValue > 0 && (
              <p className="px-3 pt-2 text-xs font-semibold tabular-nums text-surface-foreground-muted">{formatCurrency(columnValue)}</p>
            )}
            <ul className="flex-1 space-y-2 p-2">
              {columnLeads.length === 0 ? (
                <li className="px-2 py-4 text-center text-xs text-surface-foreground-muted">No leads</li>
              ) : (
                columnLeads.map((lead) => (
                  <PipelineCard key={lead.id} lead={lead} listQuery={listQuery} showAssignee={showAssignee} />
                ))
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function PipelineCard({
  lead,
  listQuery,
  showAssignee,
}: {
  lead: LeadListRow;
  listQuery?: string;
  showAssignee: boolean;
}) {
  const value = lead.job_value ?? lead.quotation_amount;
  const name = lead.customer_name || "Unnamed lead";
  const initials = initialsFor(name);

  return (
    <li>
      <Link
        href={listQuery ? `/leads/${lead.id}?${listQuery}` : `/leads/${lead.id}`}
        className="block rounded-lg border border-border bg-card p-2.5 shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        data-testid="pipeline-card"
        data-lead-id={lead.id}
      >
        <div className="flex items-start gap-2">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarFor(lead.id)}`}
            aria-hidden="true"
          >
            {initials ?? <Glyph d={ICON.user} className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{lead.phone}</p>
          </div>
        </div>
        {(value !== null || showAssignee) && (
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {value !== null && <span className="font-semibold tabular-nums text-foreground">{formatCurrency(value)}</span>}
            {showAssignee && <span className="truncate">{lead.assigned?.display_name || "Unassigned"}</span>}
          </div>
        )}
      </Link>
    </li>
  );
}
