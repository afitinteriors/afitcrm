import { getDashboardStats, getUncontactedLeads } from "@/lib/leads";
import { getUpcomingFollowUps } from "@/lib/follow-ups";
import { getUnansweredConversations } from "@/lib/conversations";
import { StatCard } from "@/components/StatCard";
import { DashboardFollowUps } from "@/components/DashboardFollowUps";
import { NeedsAttention } from "@/components/NeedsAttention";
import { formatCurrency } from "@/lib/format";
import { getCurrentProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const [stats, followUps, profile, unanswered, uncontacted] = await Promise.all([
    getDashboardStats(),
    getUpcomingFollowUps(),
    getCurrentProfile(),
    getUnansweredConversations(),
    getUncontactedLeads(),
  ]);
  const subtitle =
    profile?.role === "staff"
      ? "Overview of the leads assigned to you."
      : "Overview of your Meta/WhatsApp leads pipeline.";

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

      <div className="mt-6">
        <NeedsAttention unanswered={unanswered} uncontacted={uncontacted} overdueFollowUps={followUps} />
      </div>

      <div className="mt-6">
        <DashboardFollowUps followUps={followUps} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Leads" value={stats.totalLeads} />
        <StatCard label="New Leads" value={stats.newLeads} />
        <StatCard label="Qualified Leads" value={stats.qualifiedLeads} />
        <StatCard label="Site Visits" value={stats.siteVisits} />
        <StatCard label="Quotations" value={stats.quotations} />
        <StatCard label="Won Jobs" value={stats.wonJobs} />
        <StatCard label="Lost Leads" value={stats.lostLeads} />
        <StatCard label="Revenue" value={formatCurrency(stats.revenue)} />
      </div>
    </div>
  );
}
