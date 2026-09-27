import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";

// Substitute for the reference's "Active Projects" panel (sqft + a %
// progress bar): this project has no `projects` table and no real
// completion-percentage source, so rather than invent one, this reuses the
// exact same "Quotation/Negotiation" definition /deals already established
// -- real customer, service, location, sqft and value, no fake progress.
export function ActiveDealsList({ deals }: { deals: LeadListRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Active Deals</h2>
        <Link href="/deals" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>

      {deals.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No deals in progress right now.</p>
      ) : (
        <ul className="divide-y divide-border">
          {deals.map((lead) => {
            const value = lead.job_value ?? lead.quotation_amount;
            const subtitle = [lead.service_required, lead.location].filter(Boolean).join(" · ");
            return (
              <li key={lead.id}>
                <Link href={`/leads/${lead.id}`} className="block px-4 py-3 hover:bg-secondary">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
                    <StatusBadge status={lead.status} />
                  </div>
                  {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {lead.estimated_sqft && <span>{lead.estimated_sqft.toLocaleString("en-IN")} sqft</span>}
                    {value !== null && value !== undefined && <span className="font-medium text-foreground">{formatCurrency(value)}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
