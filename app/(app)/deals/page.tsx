import { getLeads } from "@/lib/leads";
import { DealRow } from "@/components/deals/DealRow";
import { DealCard } from "@/components/deals/DealCard";

// UI-level view over leads currently at the Quotation or Negotiation
// pipeline stage (§8) -- no new table, no new query function. getLeads({})
// already applies the same admin-sees-all / staff-sees-own-assigned
// scoping (RLS plus the existing app-level filter in lib/leads.ts) as the
// Leads page; this just narrows that same result to the two "active deal"
// statuses. Editing still happens on Lead Detail via the existing
// QuotationForm/WonLostForms -- this page is read-only.
//
// Deliberately different from /quotations (a ledger of every lead ever
// quoted, filtered by quotation_amount presence): this is a live pipeline
// snapshot, filtered by current status, so a Won or Lost lead that still
// has a quotation_amount correctly drops out of Deals once it leaves these
// two stages.
export default async function DealsPage() {
  const leads = await getLeads({});
  const deals = leads.filter((lead) => lead.status === "quotation" || lead.status === "negotiation");

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Deals</h1>
      <p className="mt-1 text-sm text-muted-foreground">Leads currently at Quotation or Negotiation.</p>

      {deals.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No deals in progress right now.
        </div>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm lg:block">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Quotation</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Job value</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deals.map((lead) => (
                  <DealRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 lg:hidden">
            {deals.map((lead) => (
              <DealCard key={lead.id} lead={lead} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
