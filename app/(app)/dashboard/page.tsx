import { getCurrentProfile } from "@/lib/auth";
import {
  getMyDutyQueue,
  getStalledPipelineLeads,
  getUnassignedLeads,
  getStaffWorkload,
  getRecentLeads,
  getTodayFollowUpProgress,
  getLeadsTrend,
  getRevenueOverview,
  getLeadSourceDistribution,
  getTeamPerformance,
  getTodaysSchedule,
} from "@/lib/dashboard-brain";
import { getFollowUps } from "@/lib/follow-ups";
import { getLeads, getStaffOverview, getDashboardStats } from "@/lib/leads";
import { groupBySiteVisitDate, type SiteVisitLead } from "@/lib/site-visits";
import { buildStaffHome } from "@/lib/staff-home";
import { businessDate } from "@/lib/business-time";
import { StaffHome } from "@/components/dashboard/StaffHome";
import { AdminHome } from "@/components/dashboard/AdminHome";

// AFIT Follow-Up Brain -- Phase A (UI only, no schema change). Admin and
// Staff are genuinely different experiences here (see
// docs/strategy/follow-up-brain/06_IMPLEMENTATION_SCOPE_AND_GUARDRAILS.md
// §9/§11) -- this page only fetches the data each role's view needs and
// branches; StaffHome and AdminHome are not the same component with
// sections hidden.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const firstName = profile?.displayName?.split(" ")[0] ?? null;

  if (profile?.role === "admin") {
    const [queue, unassigned, stalled, workload, recent, stats, trend, sourceDistribution, revenueOverview, teamPerformance, todaysSchedule, allLeads] =
      await Promise.all([
        getMyDutyQueue(),
        getUnassignedLeads(),
        getStalledPipelineLeads(),
        getStaffWorkload(),
        getRecentLeads(),
        getDashboardStats(),
        getLeadsTrend(7),
        getLeadSourceDistribution(),
        getRevenueOverview(6),
        getTeamPerformance(),
        getTodaysSchedule(),
        getLeads({}),
      ]);

    // Active Deals: the same "Quotation/Negotiation" definition /deals
    // already established -- no new query shape, just reused inline here.
    const activeDeals = allLeads
      .filter((lead) => lead.status === "quotation" || lead.status === "negotiation")
      .sort((a, b) => (b.job_value ?? b.quotation_amount ?? 0) - (a.job_value ?? a.quotation_amount ?? 0))
      .slice(0, 5);

    // Site visits: the same groupBySiteVisitDate /site-visits already uses.
    const withVisit = allLeads.filter((lead): lead is SiteVisitLead => lead.site_visit_date !== null);
    const siteVisitGroups = groupBySiteVisitDate(withVisit);

    return (
      <AdminHome
        queue={queue}
        unassigned={unassigned}
        stalled={stalled}
        workload={workload}
        recent={recent}
        stats={stats}
        trend={trend}
        sourceDistribution={sourceDistribution}
        revenueOverview={revenueOverview}
        teamPerformance={teamPerformance}
        todaysSchedule={todaysSchedule}
        activeDeals={activeDeals}
        siteVisitsToday={siteVisitGroups.today}
        siteVisitsUpcoming={siteVisitGroups.upcoming.slice(0, 5)}
      />
    );
  }

  // Staff: the same canonical attention queue, plus the staff member's own
  // leads/pending follow-ups for display detail only (service, stage, due
  // time) -- the same trio /today uses, all RLS-scoped to their own leads.
  const [queue, leads, followUps, todayProgress, overview] = await Promise.all([
    getMyDutyQueue(),
    getLeads({}),
    getFollowUps({ status: "pending" }),
    getTodayFollowUpProgress(),
    getStaffOverview(),
  ]);

  const today = businessDate();
  const siteVisitsToday = leads.filter((lead) => lead.site_visit_date === today).length;

  return (
    <StaffHome
      firstName={firstName}
      board={buildStaffHome({ dutyItems: queue.items, leads, followUps })}
      todayProgress={todayProgress}
      siteVisitsToday={siteVisitsToday}
      overview={overview}
    />
  );
}
