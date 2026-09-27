import { formatCurrency } from "@/lib/format";
import type { ExecutiveSummary, PeriodComparison } from "@/lib/reports";

function ChangeBadge({ changePct }: { changePct: number | null }) {
  if (changePct === null) return <span className="text-xs text-muted-foreground">vs prior period: n/a</span>;
  const up = changePct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-success" : "text-danger"}`}>
      {up ? "↑" : "↓"} {Math.abs(changePct)}% vs prior period
    </span>
  );
}

function KpiTile({
  label,
  value,
  comparison,
  emphasize = false,
}: {
  label: string;
  value: string;
  comparison?: PeriodComparison;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 font-semibold tabular-nums text-foreground ${emphasize ? "text-3xl" : "text-2xl"}`}>{value}</p>
      {comparison && <div className="mt-1"><ChangeBadge changePct={comparison.changePct} /></div>}
    </div>
  );
}

// Top-of-page snapshot for management: totals, rates, and monetary values
// clearly separated (never blended into one ambiguous number), each real
// figure straight from getReportsData()'s executiveSummary -- period-over-
// period comparisons only render when a prior-period value exists
// (PeriodComparison.changePct is null otherwise), never a fabricated 0%.
export function ExecutiveSummaryPanel({ summary }: { summary: ExecutiveSummary }) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Executive Summary</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiTile label="Total Leads" value={String(summary.totalLeads.current)} comparison={summary.totalLeads} emphasize />
        <KpiTile label="New Leads" value={String(summary.newLeadsCount)} />
        <KpiTile label="Qualified" value={String(summary.qualifiedCount)} />
        <KpiTile label="Won Deals" value={String(summary.wonCount.current)} comparison={summary.wonCount} />
        <KpiTile label="Won Value" value={formatCurrency(summary.wonValue.current)} comparison={summary.wonValue} />
        <KpiTile label="Quoted Deals" value={String(summary.quotedCount.current)} comparison={summary.quotedCount} />
        <KpiTile label="Quoted Value" value={formatCurrency(summary.quotedValue.current)} comparison={summary.quotedValue} />
        <KpiTile label="Pipeline Value" value={formatCurrency(summary.pipelineValue)} />
        <KpiTile label="Avg Deal Value" value={summary.averageWonValue !== null ? formatCurrency(summary.averageWonValue) : "—"} />
        <KpiTile label="Avg Quotation" value={summary.averageQuotationValue !== null ? formatCurrency(summary.averageQuotationValue) : "—"} />
        <KpiTile
          label="Overall Win Rate"
          value={summary.overallWonRate !== null ? `${Math.round(summary.overallWonRate * 100)}%` : "—"}
        />
      </div>
    </div>
  );
}
