import Link from "next/link";
import type { UnassignedLead } from "@/lib/dashboard-brain";
import { formatRelative } from "@/lib/format";
import { LEAD_STATUS_LABELS } from "@/lib/constants";

// Shared by the Admin Dashboard summary and the Admin Follow-ups
// operational view -- one renderer, not two copies of the same list.
export function UnassignedLeadsList({ items }: { items: UnassignedLead[] }) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">Every active lead is assigned.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((lead) => (
        <li key={lead.id}>
          <Link href={`/leads/${lead.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-secondary">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {LEAD_STATUS_LABELS[lead.status]} · Created {formatRelative(lead.created_at)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
