import { getLeads } from "@/lib/leads";
import type { LeadListRow } from "@/lib/leads";
import { QuotationRow } from "@/components/quotations/QuotationRow";
import { QuotationCard } from "@/components/quotations/QuotationCard";

type QuotedLead = LeadListRow & { quotation_amount: number };

// UI-level view over leads.quotation_amount (§9/§10) -- no new table, no new
// query function. getLeads({}) already applies the same admin-sees-all /
// staff-sees-own-assigned scoping as the Leads page; this just narrows that
// same result to leads that have been quoted, sorted by most recently
// touched first (same recency-first philosophy as the Leads list's own
// default sort). Unlike site_visit_date, quotation_amount has no date axis
// of its own, so there's no grouping here -- just a flat, sorted list.
// Editing still happens on Lead Detail via the existing QuotationForm --
// this page is read-only. Desktop-only per §1 ("quotations" is listed under
// Desktop's full CRM operations, not among Mobile's daily-work priorities),
// so it stays out of the mobile bottom nav, but still renders responsively
// if opened directly on a narrow viewport.
export default async function QuotationsPage() {
  const leads = await getLeads({});
  const quoted = leads
    .filter((lead): lead is QuotedLead => lead.quotation_amount !== null)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Quotations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every lead with a quotation amount recorded.</p>

      {quoted.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No quotations recorded yet.
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
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quoted.map((lead) => (
                  <QuotationRow key={lead.id} lead={lead} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 space-y-3 lg:hidden">
            {quoted.map((lead) => (
              <QuotationCard key={lead.id} lead={lead} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
