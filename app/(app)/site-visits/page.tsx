import { getLeads } from "@/lib/leads";
import { groupBySiteVisitDate, type SiteVisitLead } from "@/lib/site-visits";
import { SiteVisitRow } from "@/components/site-visits/SiteVisitRow";
import { SiteVisitCard } from "@/components/site-visits/SiteVisitCard";

function Section({ title, leads }: { title: string; leads: SiteVisitLead[] }) {
  if (leads.length === 0) return null;

  return (
    <div className="mt-4 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({leads.length})
      </h2>

      <div className="mt-2 hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm lg:block">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Customer</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Site visit</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => (
              <SiteVisitRow key={lead.id} lead={lead} />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-2 space-y-3 lg:hidden">
        {leads.map((lead) => (
          <SiteVisitCard key={lead.id} lead={lead} />
        ))}
      </ul>
    </div>
  );
}

// UI-level view over leads.site_visit_date (§9/§10) -- no new table, no new
// query function. getLeads({}) already applies the same admin-sees-all /
// staff-sees-own-assigned scoping (RLS + the app-level filter already in
// lib/leads.ts) as the Leads page; this just narrows that same result to
// leads that have a site visit scheduled. Editing still happens on Lead
// Detail via the existing SiteVisitForm -- this page is read-only.
export default async function SiteVisitsPage() {
  const leads = await getLeads({});
  const withVisit = leads.filter((lead): lead is SiteVisitLead => lead.site_visit_date !== null);
  const groups = groupBySiteVisitDate(withVisit);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Site Visits</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every lead with a scheduled or completed site visit.</p>

      {withVisit.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No site visits scheduled yet.
        </div>
      ) : (
        <div className="mt-4">
          <Section title="Today" leads={groups.today} />
          <Section title="Upcoming" leads={groups.upcoming} />
          <Section title="Past" leads={groups.past} />
        </div>
      )}
    </div>
  );
}
