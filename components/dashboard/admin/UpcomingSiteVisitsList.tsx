import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import type { SiteVisitLead } from "@/lib/site-visits";

// Substitute for the reference's "Map View" (a pinned map of Trivandrum):
// this project has no geocoding/maps integration and leads only carry a
// free-text `location` string, not lat/long, so a real map isn't possible
// without a new integration. This shows the same real site-visit data
// (today + upcoming, from the same groupBySiteVisitDate /site-visits
// already uses) as a plain list instead of inventing pins.
export function UpcomingSiteVisitsList({ today, upcoming }: { today: SiteVisitLead[]; upcoming: SiteVisitLead[] }) {
  const items = [...today, ...upcoming].slice(0, 5);
  const totalCount = today.length + upcoming.length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Site Visits</h2>
        <Link href="/site-visits" className="text-xs font-medium text-primary hover:underline">
          View All ({totalCount})
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No site visits scheduled or upcoming.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((lead) => (
            <li key={lead.id}>
              <Link href={`/leads/${lead.id}`} className="block px-4 py-3 hover:bg-secondary">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
                  <StatusBadge status={lead.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.location || "No location recorded"}</p>
                <p className="mt-0.5 text-xs font-medium text-primary">{formatDateTime(lead.site_visit_date)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
