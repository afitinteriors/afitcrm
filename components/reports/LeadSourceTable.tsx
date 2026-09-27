import type { LeadSourceSlice } from "@/lib/reports";

// Real leads.source values only (whatsapp/manual/meta_ads today), a
// CSS-bar table -- same lightweight, no-chart-library approach as
// DashboardStatusBreakdown, and renders 1:1 into the PDF export's table.
export function LeadSourceTable({ data }: { data: LeadSourceSlice[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Lead Source / Channel Analysis</h2>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No leads in this period.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {data.map((row) => (
            <li key={row.source}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.count} <span className="text-xs">({row.percentage}%)</span>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${row.percentage}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
