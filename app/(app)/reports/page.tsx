import { getReportsData } from "@/lib/reports";
import { getCurrentProfile } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/Card";
import { DashboardStatusBreakdown } from "@/components/DashboardStatusBreakdown";
import { ExecutiveSummaryPanel } from "@/components/reports/ExecutiveSummaryPanel";
import { ReportsDateFilter } from "@/components/reports/ReportsDateFilter";
import { ReportsTrendChart } from "@/components/reports/ReportsTrendChart";
import { LeadSourceTable } from "@/components/reports/LeadSourceTable";
import { ReportsExportButtons } from "@/components/reports/ReportsExportButtons";
import { formatCurrency } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatHours(value: number | null): string {
  if (value === null) return "—";
  if (value >= 48) return `${(value / 24).toFixed(1)} days`;
  return `${value.toFixed(1)} hrs`;
}

const CHECK_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
);
const X_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
);
const CURRENCY_ICON = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.75}
    d="M12 6v12m-3-9.75h4.5a2.25 2.25 0 010 4.5H10.5a2.25 2.25 0 000 4.5H15"
  />
);
const CHART_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13.5l4.5-4.5 4.5 4.5 7.5-7.5M3 20.25h18" />
);
const CLOCK_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.75V12l3.75 2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;

const SECTIONS = [
  { id: "executive-summary", label: "Executive Summary" },
  { id: "trend", label: "Trend" },
  { id: "pipeline", label: "Pipeline" },
  { id: "won-lost", label: "Won/Lost" },
  { id: "quotations", label: "Quotations" },
  { id: "sales", label: "Sales" },
  { id: "conversion", label: "Conversion" },
  { id: "lead-source", label: "Lead Source" },
  { id: "staff", label: "Staff" },
  { id: "follow-ups", label: "Follow-ups" },
];

// Management analytics report over a real, selectable reporting period
// (see lib/reports.ts / lib/report-date-filters.ts) -- admin sees every
// section's full data, staff sees the same sections computed from only
// their own leads/follow-ups (enforced in lib/reports.ts, not here -- this
// page never re-filters anything, it renders what getReportsData() already
// scoped, by both role and period).
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ datePreset?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const params = await searchParams;
  const datePreset = params.datePreset ?? "last30";
  const dateFrom = params.dateFrom ?? "";
  const dateTo = params.dateTo ?? "";

  const [data, profile] = await Promise.all([getReportsData({ datePreset, dateFrom, dateTo }), getCurrentProfile()]);
  const isAdmin = profile?.role === "admin";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin ? "Management analytics for the selected reporting period." : "A snapshot of your own leads and follow-ups for the selected period."}
          </p>
        </div>
        {isAdmin && <ReportsExportButtons filters={{ datePreset, dateFrom, dateTo }} generatedBy={profile?.displayName || "AFIT Business OS"} />}
      </div>

      <div className="mt-4">
        <ReportsDateFilter
          datePreset={data.period.preset}
          dateFrom={dateFrom}
          dateTo={dateTo}
          periodFrom={data.period.from}
          periodTo={data.period.to}
        />
      </div>

      {/* Mobile: an intentionally compact management view -- executive KPIs,
          the trend line, and the export actions -- not the full multi-
          section desktop workspace shrunk down. Reuses the exact same
          already-fetched `data`, no separate query. */}
      <div className="mt-4 space-y-4 lg:hidden">
        <ExecutiveSummaryPanel summary={data.executiveSummary} />
        <ReportsTrendChart data={data.trend} />
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Follow-up Performance</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatCard label="Completion Rate" value={formatPercent(data.followUpPerformance.completionRate)} icon={CHECK_ICON} tone="success" />
            <StatCard label="Overdue" value={data.followUpPerformance.overdueCount} icon={X_ICON} tone={data.followUpPerformance.overdueCount > 0 ? "danger" : "neutral"} />
          </div>
        </div>
        <p className="rounded-md border border-dashed border-border bg-card px-4 py-3 text-center text-xs text-muted-foreground">
          {isAdmin
            ? "Full pipeline, staff and quotation breakdowns are in the PDF/CSV export above, or view this page on a larger screen."
            : "Full pipeline and quotation breakdowns are available on a larger screen."}
        </p>
      </div>

      <div className="hidden lg:block">
        <nav aria-label="Report sections" className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="flex min-h-11 items-center rounded-full bg-secondary px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <section id="executive-summary" className="mt-6 scroll-mt-4">
          <ExecutiveSummaryPanel summary={data.executiveSummary} />
        </section>

        <section id="trend" className="mt-6 scroll-mt-4">
          <ReportsTrendChart data={data.trend} />
        </section>

        <section id="pipeline" className="mt-6 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Pipeline Distribution</h2>
          <div className="mt-2">
            <DashboardStatusBreakdown
              statusBreakdown={data.pipelineDistribution.statusBreakdown}
              totalLeads={data.pipelineDistribution.totalLeads}
            />
          </div>
        </section>

        <section id="won-lost" className="mt-6 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Won / Lost</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Won" value={data.wonLost.wonCount} icon={CHECK_ICON} tone="success" />
            <StatCard label="Lost" value={data.wonLost.lostCount} icon={X_ICON} tone="danger" />
            <StatCard label="Win Rate" value={formatPercent(data.wonLost.winRate)} icon={CHART_ICON} />
            <StatCard label="Total Won Value" value={formatCurrency(data.wonLost.totalWonValue)} icon={CURRENCY_ICON} tone="success" />
          </div>
          {data.wonLost.lostReasons.length > 0 && (
            <Card title="Lost reasons" action={undefined}>
              <ul className="space-y-2">
                {data.wonLost.lostReasons.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{r.reason}</span>
                    <span className="font-medium tabular-nums text-muted-foreground">{r.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section id="quotations" className="mt-6 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Quotation Performance</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Quoted" value={data.quotationPerformance.quotedCount} icon={CURRENCY_ICON} />
            <StatCard label="Total Quoted Value" value={formatCurrency(data.quotationPerformance.totalQuotedValue)} icon={CURRENCY_ICON} />
            <StatCard label="Avg Quotation" value={data.quotationPerformance.averageQuotationAmount !== null ? formatCurrency(data.quotationPerformance.averageQuotationAmount) : "—"} icon={CURRENCY_ICON} />
            <StatCard label="Quote → Won Rate" value={formatPercent(data.quotationPerformance.quoteToWonRate)} icon={CHART_ICON} />
          </div>
        </section>

        <section id="sales" className="mt-6 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Sales Performance</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Won Deals" value={data.salesPerformance.wonCount} icon={CHECK_ICON} tone="success" />
            <StatCard label="Total Won Value" value={formatCurrency(data.salesPerformance.totalWonValue)} icon={CURRENCY_ICON} tone="success" />
          </div>

          {data.salesPerformance.byStaff.length > 0 && (
            <Card title="By staff">
              <ul className="space-y-2">
                {data.salesPerformance.byStaff.map((row) => (
                  <li key={row.staffId} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.displayName}</span>
                    <span className="text-muted-foreground">
                      {row.wonCount} won · <span className="font-medium tabular-nums text-foreground">{formatCurrency(row.wonValue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.salesPerformance.byService.length > 0 && (
            <Card title="By service">
              <ul className="space-y-2">
                {data.salesPerformance.byService.map((row) => (
                  <li key={row.service} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.service}</span>
                    <span className="text-muted-foreground">
                      {row.wonCount} won · <span className="font-medium tabular-nums text-foreground">{formatCurrency(row.wonValue)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section id="conversion" className="mt-6 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Conversion</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Share of every lead (excluding invalid) that has reached Won, among leads created in the selected period. For the current
            status breakdown, see{" "}
            <a href="#pipeline" className="text-primary hover:underline">
              Pipeline Distribution
            </a>{" "}
            above.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Overall Won Rate" value={formatPercent(data.conversion.overallWonRate)} icon={CHART_ICON} emphasize />
          </div>
        </section>

        <section id="lead-source" className="mt-6 scroll-mt-4">
          <LeadSourceTable data={data.leadSourceBreakdown} />
        </section>

        <section id="staff" className="mt-6 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Staff Performance</h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Staff</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Leads</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Won</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Won Value</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Follow-ups Done</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Overdue</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Avg Qualification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.staffPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No staff performance data yet.
                    </td>
                  </tr>
                ) : (
                  data.staffPerformance.map((row) => (
                    <tr key={row.staffId}>
                      <td className="px-4 py-3 font-medium text-foreground">{row.displayName}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{row.leadsAssigned}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{row.wonCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-foreground">{formatCurrency(row.wonValue)}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{row.followUpsCompleted}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{row.followUpsOverdue}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {row.avgQualificationScore !== null ? Math.round(row.avgQualificationScore) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="follow-ups" className="mt-6 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Follow-up Performance</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Completion Rate" value={formatPercent(data.followUpPerformance.completionRate)} icon={CHECK_ICON} tone="success" />
            <StatCard label="Overdue" value={data.followUpPerformance.overdueCount} icon={X_ICON} tone="danger" />
            <StatCard label="Avg Time to Complete" value={formatHours(data.followUpPerformance.avgTimeToCompleteHours)} icon={CLOCK_ICON} />
          </div>
          <Card title="By type">
            <ul className="space-y-2">
              {data.followUpPerformance.byType.map((row) => (
                <li key={row.type} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{FOLLOW_UP_TYPE_LABELS[row.type]}</span>
                  <span className="font-medium tabular-nums text-muted-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </div>
  );
}
