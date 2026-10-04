import Link from "next/link";
import type { UnassignedSummary } from "@/lib/assignment-logic";

// Admin dashboard card for the assignment queue. Every number comes from the
// same unassigned-lead rows the queue uses (open statuses, no owner, not
// merged) -- nothing is invented, and there is no capacity or "critical"
// category because the system defines neither.
export function UnassignedSummaryCard({ summary }: { summary: UnassignedSummary }) {
  if (summary.total === 0) {
    return (
      <section aria-labelledby="unassigned-summary-title" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 id="unassigned-summary-title" className="text-sm font-semibold text-foreground">
          Unassigned leads
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">All leads assigned</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="unassigned-summary-title" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="unassigned-summary-title" className="text-sm font-semibold text-foreground">
            Unassigned leads
          </h2>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.total} <span className="text-sm font-medium text-muted-foreground">unassigned</span>
          </p>
        </div>
        <Link
          href="/leads/unassigned"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Review &amp; Assign
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:max-w-sm">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">Older than 24h</dt>
          <dd className={`text-sm font-semibold ${summary.olderThan24h > 0 ? "text-danger" : "text-foreground"}`}>{summary.olderThan24h}</dd>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">Created today</dt>
          <dd className="text-sm font-semibold text-foreground">{summary.createdToday}</dd>
        </div>
      </dl>
    </section>
  );
}
