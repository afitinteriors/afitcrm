"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LeadSourceSlice } from "@/lib/dashboard-brain";

// Real lib/constants.ts LEAD_SOURCES palette, reused so a source's color
// stays the same wherever it's shown -- brand green reserved for
// "whatsapp" (this CRM's actual dominant channel), not spent on a
// decorative rainbow.
const COLORS: Record<string, string> = {
  whatsapp: "#16a34a",
  meta_ads: "#6366f1",
  manual: "#94a3b8",
  phone: "#0ea5e9",
  referral: "#f59e0b",
  website: "#a855f7",
  walk_in: "#f97316",
  other: "#a1a1aa",
};

export function LeadSourceDonut({ data }: { data: LeadSourceSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Lead Source Distribution</h2>

      {data.length === 0 ? (
        <p className="mt-6 py-10 text-center text-sm text-muted-foreground">No leads yet.</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="label" innerRadius="65%" outerRadius="100%" paddingAngle={2} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.source} fill={COLORS[d.source] ?? COLORS.other} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--border)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-foreground">{total}</span>
              <span className="text-xs text-muted-foreground">Total Leads</span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-1.5">
            {data.map((d) => (
              <li key={d.source} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[d.source] ?? COLORS.other }} />
                  <span className="truncate text-foreground">{d.label}</span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {d.percentage}% <span className="text-xs">({d.count})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
