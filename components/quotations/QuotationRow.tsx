import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";

// Desktop table row -- same structure as LeadRow.tsx, but shows
// quotation_amount specifically rather than LeadRow's job_value-or-
// quotation_amount value column. A Won lead keeps its original
// quotation_amount even though job_value (the closed value) may differ, and
// this view exists to show quotes, not closed value -- see QuotationCard.tsx
// for the same reasoning.
export function QuotationRow({ lead }: { lead: LeadListRow & { quotation_amount: number } }) {
  return (
    <tr className="hover:bg-secondary">
      <td className="px-4 py-3">
        <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:underline">
          {lead.customer_name || "Unnamed lead"}
        </Link>
        <p className="text-xs text-muted-foreground">{lead.phone}</p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-foreground">
        {formatCurrency(lead.quotation_amount)}
      </td>
      <td className="px-4 py-3 text-foreground">{lead.assigned?.display_name || "Unassigned"}</td>
    </tr>
  );
}
