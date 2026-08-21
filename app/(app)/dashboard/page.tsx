import { getDashboardStats } from "@/lib/leads";
import { StatCard } from "@/components/StatCard";
import { formatCurrency } from "@/lib/format";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Overview of your Meta/WhatsApp leads pipeline.</p>

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
