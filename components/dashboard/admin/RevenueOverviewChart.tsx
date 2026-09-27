"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RevenueOverviewPoint } from "@/lib/dashboard-brain";
import { formatCurrency, formatLakhs } from "@/lib/format";

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
}

// Quotation value vs. actual won value, per business-month (see
// getRevenueOverview) -- real quotation_amount/job_value sums only, bucketed
// by updated_at the same way getStaffOverview's monthly stats already are.
export function RevenueOverviewChart({ data }: { data: RevenueOverviewPoint[] }) {
  const totalWon = data.reduce((sum, p) => sum + p.wonValue, 0);
  const hasAny = data.some((p) => p.quotationValue + p.wonValue > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Revenue Overview</h2>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">{formatLakhs(totalWon)}</p>
          <p className="text-xs text-muted-foreground">Won this period</p>
        </div>
      </div>

      {!hasAny ? (
        <p className="mt-6 py-10 text-center text-sm text-muted-foreground">No quotations or won deals in this period yet.</p>
      ) : (
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => formatLakhs(v as number)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                labelFormatter={(m) => monthLabel(m as string)}
                formatter={(v) => formatCurrency(typeof v === "number" ? v : Number(v))}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--border)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="quotationValue" name="Quotation Value" fill="#a855f7" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="wonValue" name="Won Value" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
