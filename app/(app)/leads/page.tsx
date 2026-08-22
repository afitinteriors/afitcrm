import { getCampaignOptions, getLeads } from "@/lib/leads";
import { LeadsFilterBar } from "@/components/LeadsFilterBar";
import { LeadRow } from "@/components/LeadRow";
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

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{heading}</h1>

      <div className="mt-4">
        <LeadsFilterBar
          search={search}
          status={status}
          campaign={campaign}
          campaignOptions={campaignOptions}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Customer</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Phone</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Campaign</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No leads match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
