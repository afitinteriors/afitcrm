"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";
import type { LeadListRow } from "@/lib/leads";

export function LeadRow({ lead }: { lead: LeadListRow }) {
  const router = useRouter();
  // Won's actual closed value takes precedence once it exists (see
  // leads/[id]/page.tsx) -- keeps this list consistent with Lead Detail.
  const value = lead.job_value ?? lead.quotation_amount;
  const wasUpdated = new Date(lead.updated_at).getTime() - new Date(lead.created_at).getTime() > 60_000;

  return (
    <tr className="cursor-pointer hover:bg-secondary" onClick={() => router.push(`/leads/${lead.id}`)}>
      <td className="px-4 py-3">
        <Link
          href={`/leads/${lead.id}`}
          className="font-medium text-foreground hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {lead.customer_name || "Unnamed lead"}
        </Link>
        <p className="text-xs text-muted-foreground">{lead.phone}</p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3 text-foreground">{lead.assigned?.display_name || "Unassigned"}</td>
      <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-foreground">
        {value ? formatCurrency(value) : <span className="font-normal text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
        {formatDate(lead.created_at)}
        {wasUpdated && <p className="text-xs">Updated {formatRelative(lead.updated_at)}</p>}
      </td>
    </tr>
  );
}
