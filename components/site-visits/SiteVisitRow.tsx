import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";

// Desktop table row -- same structure as LeadRow.tsx, but built around
// site_visit_date (this view's own reason to exist) instead of LeadRow's
// job_value/quotation_amount column, since LeadRow doesn't surface that
// field at all.
export function SiteVisitRow({ lead }: { lead: LeadListRow }) {
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
      <td className="px-4 py-3 whitespace-nowrap text-foreground">{formatDateTime(lead.site_visit_date)}</td>
      <td className="px-4 py-3 text-foreground">{lead.assigned?.display_name || "Unassigned"}</td>
    </tr>
  );
}
