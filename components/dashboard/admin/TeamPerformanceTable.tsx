import type { TeamPerformanceRow } from "@/lib/dashboard-brain";

// Lifetime per-staff counts (see getTeamPerformance) -- real assigned-lead
// totals, not the reference's invented 5-person roster. Today this project
// has exactly one staff account, so this table will show one real row
// until more staff are added; it isn't padded to look fuller than it is.
export function TeamPerformanceTable({ rows }: { rows: TeamPerformanceRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Team Performance</h2>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No staff accounts yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Staff</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Leads</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Visits</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Won</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground">Conv.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.staffId}>
                  <td className="px-4 py-2 font-medium text-foreground">{r.displayName || "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.totalLeads}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.siteVisits}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.won}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-primary">{r.conversionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
