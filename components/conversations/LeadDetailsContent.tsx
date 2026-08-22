import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { telLink, whatsappLink } from "@/lib/format";
import type { LeadRow } from "@/lib/supabase/types";

export function LeadDetailsContent({ lead }: { lead: Pick<LeadRow, "id" | "customer_name" | "phone" | "status" | "location" | "service_required"> | null }) {
  if (!lead) {
    return (
      <div className="p-4 text-sm text-slate-500">
        This conversation isn&apos;t linked to a lead yet.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-base font-semibold text-slate-900">{lead.customer_name || "Unnamed lead"}</p>
        <p className="text-sm text-slate-500">{lead.phone}</p>
      </div>

      <StatusBadge status={lead.status} />

      <dl className="space-y-2 text-sm">
        {lead.location && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Location</dt>
            <dd className="text-slate-900">{lead.location}</dd>
          </div>
        )}
        {lead.service_required && (
          <div>
            <dt className="text-xs font-medium text-slate-500">Service required</dt>
            <dd className="text-slate-900">{lead.service_required}</dd>
          </div>
        )}
      </dl>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <a
          href={telLink(lead.phone)}
          className="flex items-center justify-center rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-100"
        >
          Call
        </a>
        <a
          href={whatsappLink(lead.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-100"
        >
          WhatsApp
        </a>
      </div>

      <Link
        href={`/leads/${lead.id}`}
        className="block rounded-lg bg-blue-600 py-2.5 text-center text-sm font-medium text-white active:bg-blue-700"
      >
        View full lead
      </Link>
    </div>
  );
}
