import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatRelative } from "@/lib/format";
import type { RecentLead } from "@/lib/dashboard-brain";

export function RecentLeadsPanel({ leads }: { leads: RecentLead[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Recent Leads</h2>
        <Link href="/leads" className="text-xs font-medium text-primary hover:underline">
          View All
        </Link>
      </div>

      {leads.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No leads yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {leads.map((lead) => {
            const subtitle = [lead.service_required, lead.location].filter(Boolean).join(" · ");
            return (
              <li key={lead.id}>
                <Link href={`/leads/${lead.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-secondary">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
                    <p className="truncate text-xs text-muted-foreground">{subtitle || "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={lead.status} />
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelative(lead.created_at)}</p>
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
