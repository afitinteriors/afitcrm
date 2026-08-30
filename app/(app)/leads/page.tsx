import { getCampaignOptions, getLeads } from "@/lib/leads";
import { LeadsFilterBar } from "@/components/LeadsFilterBar";
import { LeadRow } from "@/components/LeadRow";
import { LeadCard } from "@/components/LeadCard";
import { getCurrentProfile } from "@/lib/auth";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; campaign?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "";
  const campaign = params.campaign ?? "";

  const [leads, campaignOptions, profile] = await Promise.all([
    getLeads({ search, status, campaign }),
    getCampaignOptions(),
    getCurrentProfile(),
  ]);

  const heading = profile?.role === "staff" ? "My Leads" : "Leads";
  const description =
    profile?.role === "staff"
      ? "Leads currently assigned to you."
      : "All leads across every campaign and staff member.";

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{heading}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4">
        <LeadsFilterBar
          search={search}
          status={status}
          campaign={campaign}
          campaignOptions={campaignOptions}
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {leads.length} {leads.length === 1 ? "lead" : "leads"}
      </p>

      {leads.length === 0 ? (
        <div className="mt-2 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No leads match your filters.
        </div>
      ) : (
        <>
          {/* Desktop: table. Mobile: dedicated cards below, not a squeezed table. */}
          <div className="mt-2 hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm lg:block">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Owner</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Value</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-2 space-y-3 lg:hidden">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
