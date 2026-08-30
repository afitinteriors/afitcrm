import { getDashboardStats, getUncontactedLeads } from "@/lib/leads";
import { getUpcomingFollowUps } from "@/lib/follow-ups";
import { getUnansweredConversations } from "@/lib/conversations";
import { StatCard } from "@/components/StatCard";
import { DashboardFollowUps } from "@/components/DashboardFollowUps";
import { DashboardStatusBreakdown } from "@/components/DashboardStatusBreakdown";
import { NeedsAttention } from "@/components/NeedsAttention";
import { formatCurrency } from "@/lib/format";
import { getCurrentProfile } from "@/lib/auth";

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const TOTAL_LEADS_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />
);

const NEW_LEADS_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859" />
);

const QUALIFIED_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m6 2.25a9 9 0 11-18 0 9 9 0 0118 0z" />
);

const SITE_VISIT_ICON = (
  <>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </>
);

const QUOTATION_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
);

const WON_ICON = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.75}
    d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941"
  />
);

const LOST_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
);

const REVENUE_ICON = (
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm6 0h.008v.008H21V10.5zm-18 0h.008v.008H3V10.5z" />
);

export default async function DashboardPage() {
  const [stats, followUps, profile, unanswered, uncontacted] = await Promise.all([
    getDashboardStats(),
    getUpcomingFollowUps(),
    getCurrentProfile(),
    getUnansweredConversations(),
    getUncontactedLeads(),
  ]);

  const greeting = getGreeting(new Date().getHours());
  const firstName = profile?.displayName?.split(" ")[0];
  const subtitle =
    profile?.role === "staff"
      ? "Here's an overview of the leads assigned to you."
      : "Here's today's overview of your Meta/WhatsApp leads pipeline.";

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {firstName ? `${greeting}, ${firstName}. ` : `${greeting}. `}
        {subtitle}
      </p>

      <div className="mt-6">
        <NeedsAttention unanswered={unanswered} uncontacted={uncontacted} overdueFollowUps={followUps} />
      </div>

      <div className="mt-6">
        <DashboardFollowUps followUps={followUps} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Total Leads" value={stats.totalLeads} icon={TOTAL_LEADS_ICON} tone="neutral" href="/leads" />
        <StatCard
          label="New Leads"
          value={stats.newLeads}
          icon={NEW_LEADS_ICON}
          tone={stats.newLeads > 0 ? "warning" : "neutral"}
          href="/leads?status=new"
        />
        <StatCard
          label="Qualified"
          value={stats.qualifiedLeads}
          icon={QUALIFIED_ICON}
          tone="accent"
          href="/leads?status=qualified"
        />
        <StatCard
          label="Site Visits"
          value={stats.siteVisits}
          icon={SITE_VISIT_ICON}
          tone="accent"
          href="/leads?status=site_visit"
        />
        <StatCard
          label="Quotations"
          value={stats.quotations}
          icon={QUOTATION_ICON}
          tone="accent"
          href="/leads?status=quotation"
        />
        <StatCard
          label="Won Jobs"
          value={stats.wonJobs}
          icon={WON_ICON}
          tone="success"
          href="/leads?status=won"
        />
        <StatCard
          label="Lost Leads"
          value={stats.lostLeads}
          icon={LOST_ICON}
          tone={stats.lostLeads > 0 ? "danger" : "neutral"}
          href="/leads?status=lost"
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(stats.revenue)}
          icon={REVENUE_ICON}
          tone="success"
          emphasize
        />
      </div>

      {/* Full pipeline visualization is desktop workspace content -- mobile
          stays action-oriented (current-stage + next-step focus) rather
          than a funnel chart. */}
      <div className="mt-6 hidden lg:block">
        <DashboardStatusBreakdown statusBreakdown={stats.statusBreakdown} totalLeads={stats.totalLeads} />
      </div>
    </div>
  );
}
