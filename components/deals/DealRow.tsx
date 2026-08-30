import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";

// Desktop table row -- same structure as LeadRow/SiteVisitRow/QuotationRow,
// but shows quotation_amount and job_value as two distinct columns (this
// view's own reason to exist) rather than LeadRow's single merged value
// column, since a deal in progress is exactly the case where those two
// numbers can differ and both matter.
export function DealRow({ lead }: { lead: LeadListRow }) {
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
      <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-foreground">
        {formatCurrency(lead.job_value)}
      </td>
      <td className="px-4 py-3 text-foreground">{lead.assigned?.display_name || "Unassigned"}</td>
    </tr>
  );
}
