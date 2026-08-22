"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { LeadRow as LeadRowData } from "@/lib/supabase/types";

export function LeadRow({ lead }: { lead: LeadRowData }) {
  const router = useRouter();

  return (
    <tr
      className="cursor-pointer hover:bg-slate-50"
      onClick={() => router.push(`/leads/${lead.id}`)}
    >
      <td className="px-4 py-3">
        <Link
          href={`/leads/${lead.id}`}
          className="font-medium text-slate-900 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {lead.customer_name || "Unnamed lead"}
        </Link>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{lead.phone}</td>
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>
      <td className="px-4 py-3 text-slate-600">{lead.campaign_name || "—"}</td>
      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(lead.created_at)}</td>
    </tr>
  );
}
