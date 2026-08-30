import Link from "next/link";
import type { LeadStatus } from "@/lib/supabase/types";
import { PIPELINE_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_BAR_CLASSES } from "@/lib/constants";

// Lightweight CSS-only pipeline bar -- no chart library. Segment widths and
// legend counts both come straight from statusBreakdown (getDashboardStats),
// so this can never show a status or a count the backend didn't return.
// Statuses with zero leads are omitted from the legend to stay scannable,
// but every non-zero status is shown with both a color swatch AND its label
// + count, not color alone (funnel stages must stay distinguishable without
// relying on hue -- WCAG "don't convey information by color alone").
//
// Restricted to PIPELINE_STATUSES (not the full LEAD_STATUSES) -- "invalid"
// is a data-quality disposition, not a sales-pipeline stage, so it's
// deliberately excluded from this visualization even though
// statusBreakdown carries a count for it.
export function DashboardStatusBreakdown({
  statusBreakdown,
  totalLeads,
}: {
  statusBreakdown: Record<LeadStatus, number>;
  totalLeads: number;
}) {
  const present = PIPELINE_STATUSES.filter((status) => statusBreakdown[status] > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Lead Pipeline</h2>

      {totalLeads === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No leads yet.</p>
      ) : (
        <>
          <div
            role="img"
            aria-label={present
              .map((status) => `${LEAD_STATUS_LABELS[status]}: ${statusBreakdown[status]}`)
              .join(", ")}
            className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted"
          >
            {present.map((status) => (
              <div
                key={status}
                className={LEAD_STATUS_BAR_CLASSES[status]}
                style={{ width: `${(statusBreakdown[status] / totalLeads) * 100}%` }}
              />
            ))}
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-2">
            {present.map((status) => (
              <li key={status}>
                <Link
                  href={`/leads?status=${status}`}
                  className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-foreground hover:bg-secondary hover:text-primary"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${LEAD_STATUS_BAR_CLASSES[status]}`}
                  />
                  <span>{LEAD_STATUS_LABELS[status]}</span>
                  <span className="font-semibold tabular-nums text-muted-foreground">
                    {statusBreakdown[status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
