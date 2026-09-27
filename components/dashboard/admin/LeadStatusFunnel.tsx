import { LEAD_STATUS_CHART_COLORS, LEAD_STATUS_LABELS } from "@/lib/constants";
import type { LeadStatus } from "@/lib/supabase/types";

// The pipeline's own funnel order, New through Won (Lost/Invalid are
// dispositions, not funnel stages -- same PIPELINE_STATUSES convention
// used everywhere else, minus Lost since a funnel widens/narrows through
// a single forward path). Counts come straight from getDashboardStats()'s
// statusBreakdown -- the same tally the KPI tiles use, so this can never
// disagree with them.
const FUNNEL_STAGES: LeadStatus[] = ["new", "contacted", "qualified", "site_visit", "quotation", "negotiation", "won"];

export function LeadStatusFunnel({ statusBreakdown }: { statusBreakdown: Record<LeadStatus, number> }) {
  const base = statusBreakdown.new || 1;
  const maxWidth = 100;
  const minWidth = 32;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Lead Status Funnel</h2>

      <div className="mt-4 space-y-1.5">
        {FUNNEL_STAGES.map((stage, i) => {
          const count = statusBreakdown[stage] ?? 0;
          const pct = Math.round((count / base) * 100);
          const width = Math.max(minWidth, maxWidth - i * ((maxWidth - minWidth) / (FUNNEL_STAGES.length - 1)));
          return (
            <div key={stage} className="flex items-center gap-3">
              <div className="flex w-24 shrink-0 items-baseline justify-end gap-1.5 text-right">
                <span className="text-sm font-semibold tabular-nums text-foreground">{count}</span>
                <span className="text-xs tabular-nums text-muted-foreground">({pct}%)</span>
              </div>
              <div className="h-7 flex-1">
                <div
                  className="h-7 rounded-md"
                  style={{ width: `${width}%`, backgroundColor: LEAD_STATUS_CHART_COLORS[stage] }}
                  role="img"
                  aria-label={`${LEAD_STATUS_LABELS[stage]}: ${count} leads (${pct}%)`}
                />
              </div>
              <span className="w-24 shrink-0 truncate text-xs font-medium text-muted-foreground">{LEAD_STATUS_LABELS[stage]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
