import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { DutyList } from "@/components/dashboard/DutyList";
import { UnassignedLeadsList } from "@/components/dashboard/UnassignedLeadsList";
import { StalledPipelineList } from "@/components/dashboard/StalledPipelineList";
import { AdminKpiTiles } from "@/components/dashboard/admin/AdminKpiTiles";
import { LeadsTrendChart } from "@/components/dashboard/admin/LeadsTrendChart";
import { LeadSourceDonut } from "@/components/dashboard/admin/LeadSourceDonut";
import { LeadStatusFunnel } from "@/components/dashboard/admin/LeadStatusFunnel";
import { RevenueOverviewChart } from "@/components/dashboard/admin/RevenueOverviewChart";
import { RecentLeadsPanel } from "@/components/dashboard/admin/RecentLeadsPanel";
import { ActiveDealsList } from "@/components/dashboard/admin/ActiveDealsList";
import { TeamPerformanceTable } from "@/components/dashboard/admin/TeamPerformanceTable";
import { TodaysScheduleList } from "@/components/dashboard/admin/TodaysScheduleList";
import { UpcomingSiteVisitsList } from "@/components/dashboard/admin/UpcomingSiteVisitsList";
import type {
  DutyQueue,
  LeadsTrendPoint,
  LeadSourceSlice,
  RecentLead,
  RevenueOverviewPoint,
  ScheduleItem,
  StalledPipelineLead,
  StaffWorkloadRow,
  TeamPerformanceRow,
  UnassignedLead,
} from "@/lib/dashboard-brain";
import type { DashboardStats } from "@/lib/leads";
import type { LeadListRow } from "@/lib/leads";
import type { SiteVisitLead } from "@/lib/site-visits";
import { formatCurrency } from "@/lib/format";

const OVERDUE_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />;
const UNASSIGNED_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />;
const RISK_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.947-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007" />;
const NO_ACTION_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;

function StaffWorkloadTable({ rows }: { rows: StaffWorkloadRow[] }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No staff accounts yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Staff</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Open Leads</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.staffId}>
              <td className="px-4 py-2 font-medium text-foreground">{r.displayName || "—"}</td>
              <td className="px-4 py-2 text-muted-foreground">{r.openLeads}</td>
              <td className={`px-4 py-2 ${r.overdueFollowUps > 0 ? "font-semibold text-danger" : "text-muted-foreground"}`}>
                {r.overdueFollowUps}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Admin desktop + mobile home, rebuilt to match design/admin-dashboard-
// reference.png's layout/hierarchy/spacing while keeping this project's own
// design tokens (dark green chrome, not the reference's literal color
// palette -- see CLAUDE.md's UI/UX Rules). Every KPI/chart/list below is
// real data (getDashboardStats, getLeadsTrend, getLeadSourceDistribution,
// getRevenueOverview, getTeamPerformance, getTodaysSchedule -- lib/
// dashboard-brain.ts); the reference's Active Projects/Map View/System
// Status panels have no real backing data in this schema, so Active
// Projects is substituted with the existing "Deals" definition
// (Quotation/Negotiation leads) and Map View with a plain upcoming-site-
// visits list (no lat/long or maps integration exists); System Status is
// omitted entirely (would need new infra-monitoring capability and touches
// WABIS, which is under its own separate change freeze).
//
// The pre-existing exception-monitoring panels (Overdue Work, Unassigned
// Leads, Staff Workload, Pipeline Attention) are preserved unchanged, not
// deleted, under "Alerts & Operational Monitoring" -- the reference brief
// explicitly asks for "alerts and operational monitoring" and this is
// already real, working coverage of exactly that.
export function AdminHome({
  queue,
  unassigned,
  stalled,
  workload,
  recent,
  stats,
  trend,
  sourceDistribution,
  revenueOverview,
  teamPerformance,
  todaysSchedule,
  activeDeals,
  siteVisitsToday,
  siteVisitsUpcoming,
}: {
  queue: DutyQueue;
  unassigned: UnassignedLead[];
  stalled: StalledPipelineLead[];
  workload: StaffWorkloadRow[];
  recent: RecentLead[];
  stats: DashboardStats;
  trend: LeadsTrendPoint[];
  sourceDistribution: LeadSourceSlice[];
  revenueOverview: RevenueOverviewPoint[];
  teamPerformance: TeamPerformanceRow[];
  todaysSchedule: ScheduleItem[];
  activeDeals: LeadListRow[];
  siteVisitsToday: SiteVisitLead[];
  siteVisitsUpcoming: SiteVisitLead[];
}) {
  const overdueItems = queue.items.filter((i) => i.reasonKind === "overdue_follow_up" || i.reasonKind === "due_today_follow_up");
  const stalledValue = stalled.reduce((sum, l) => sum + (l.quotation_amount ?? l.job_value ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Complete overview of your business performance and operations.</p>

      {/* ---------- Desktop ---------- */}
      <div className="mt-5 hidden lg:block">
        <AdminKpiTiles
          totalLeads={stats.totalLeads}
          newLeads={stats.newLeads}
          siteVisits={stats.siteVisitScheduledCount}
          quotations={stats.quotedCount}
          won={stats.wonJobs}
          revenue={formatCurrency(stats.revenue)}
        />

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LeadsTrendChart data={trend} />
          <LeadSourceDonut data={sourceDistribution} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LeadStatusFunnel statusBreakdown={stats.statusBreakdown} />
          <RevenueOverviewChart data={revenueOverview} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <RecentLeadsPanel leads={recent} />
          <ActiveDealsList deals={activeDeals} />
          <TodaysScheduleList items={todaysSchedule} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <TeamPerformanceTable rows={teamPerformance} />
          <UpcomingSiteVisitsList today={siteVisitsToday} upcoming={siteVisitsUpcoming} />
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Alerts &amp; Operational Monitoring</h2>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <StatCard label="Overdue (Team)" value={queue.counts.overdue} icon={OVERDUE_ICON} tone={queue.counts.overdue > 0 ? "danger" : "neutral"} />
            <StatCard label="Unassigned Leads" value={unassigned.length} icon={UNASSIGNED_ICON} tone={unassigned.length > 0 ? "warning" : "neutral"} />
            <StatCard label="No Follow-up" value={queue.counts.noFollowUp} icon={NO_ACTION_ICON} tone={queue.counts.noFollowUp > 0 ? "warning" : "neutral"} />
            <StatCard label="Pipeline at Risk" value={formatCurrency(stalledValue)} icon={RISK_ICON} tone={stalledValue > 0 ? "danger" : "neutral"} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Overdue Work (Team)</h3>
              </div>
              <DutyList items={overdueItems} emptyLabel="No overdue work anywhere." />
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Unassigned Leads</h3>
              </div>
              <UnassignedLeadsList items={unassigned} />
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Staff Workload</h3>
              </div>
              <StaffWorkloadTable rows={workload} />
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Pipeline Attention (Quotation/Negotiation)</h3>
              </div>
              <StalledPipelineList items={stalled} />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Mobile: a deliberately limited utility view, not the
          desktop dashboard compressed (an admin needs the same quick real
          counts + the day's schedule + the single most urgent list on a
          phone, not every chart/table shrunk to illegibility). ---------- */}
      <div className="mt-5 space-y-4 lg:hidden">
        <AdminKpiTiles
          totalLeads={stats.totalLeads}
          newLeads={stats.newLeads}
          siteVisits={stats.siteVisitScheduledCount}
          quotations={stats.quotedCount}
          won={stats.wonJobs}
          revenue={formatCurrency(stats.revenue)}
          compact
        />

        <LeadsTrendChart data={trend} simple />
        <TodaysScheduleList items={todaysSchedule} />

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Needs Intervention</h2>
          </div>
          <DutyList items={overdueItems.slice(0, 8)} emptyLabel="Nothing needs intervention right now." />
        </div>

        <Link href="/leads" className="block rounded-md border border-border bg-secondary px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-muted">
          Open full Leads list →
        </Link>
      </div>
    </div>
  );
}
