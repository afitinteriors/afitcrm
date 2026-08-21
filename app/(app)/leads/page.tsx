import Link from "next/link";
import { getCampaignOptions, getLeads } from "@/lib/leads";
import { LeadsFilterBar } from "@/components/LeadsFilterBar";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; campaign?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const status = params.status ?? "";
  const campaign = params.campaign ?? "";

  const [leads, campaignOptions] = await Promise.all([
    getLeads({ search, status, campaign }),
    getCampaignOptions(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
        <Link
          href="/leads/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 sm:hidden"
        >
          New Lead
        </Link>
      </div>

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
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:underline">
                    {lead.customer_name || "Unnamed lead"}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{lead.phone}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.campaign_name || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                  {formatDate(lead.created_at)}
                </td>
              </tr>
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
