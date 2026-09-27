"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/reports";
import { LEAD_STATUS_CHART_COLORS, LEAD_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const SERIES: { key: keyof Omit<TrendPoint, "date">; color: string; label: string }[] = [
  { key: "new", color: LEAD_STATUS_CHART_COLORS.new, label: LEAD_STATUS_LABELS.new },
  { key: "contacted", color: LEAD_STATUS_CHART_COLORS.contacted, label: LEAD_STATUS_LABELS.contacted },
  { key: "qualified", color: LEAD_STATUS_CHART_COLORS.qualified, label: LEAD_STATUS_LABELS.qualified },
  { key: "quotation", color: LEAD_STATUS_CHART_COLORS.quotation, label: LEAD_STATUS_LABELS.quotation },
  { key: "won", color: LEAD_STATUS_CHART_COLORS.won, label: LEAD_STATUS_LABELS.won },
];

function shortDay(date: string): string {
  return formatDate(date).replace(/ \d{4}$/, "");
}

// Daily lead-creation counts by current status, for every business day in
// the selected reporting period (see computeTrendByDay in lib/reports.ts) --
// real data only, capped upstream at 120 points so a very wide custom range
// never renders an unusably dense line.
export function ReportsTrendChart({ data }: { data: TrendPoint[] }) {
  const hasAny = data.some((p) => p.new + p.contacted + p.qualified + p.quotation + p.won > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Lead Volume Trend</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="mt-6 py-10 text-center text-sm text-muted-foreground">Selected range is too wide to chart daily.</p>
      ) : !hasAny ? (
        <p className="mt-6 py-10 text-center text-sm text-muted-foreground">No leads created in this period.</p>
      ) : (
        <div className="mt-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                labelFormatter={(d) => formatDate(d as string)}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--border)" }}
              />
              {SERIES.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
