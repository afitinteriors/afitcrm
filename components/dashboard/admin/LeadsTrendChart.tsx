"use client";

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LeadsTrendPoint } from "@/lib/dashboard-brain";
import { LEAD_STATUS_CHART_COLORS, LEAD_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const SERIES: { key: keyof Omit<LeadsTrendPoint, "date">; color: string; label: string }[] = [
  { key: "new", color: LEAD_STATUS_CHART_COLORS.new, label: LEAD_STATUS_LABELS.new },
  { key: "contacted", color: LEAD_STATUS_CHART_COLORS.contacted, label: LEAD_STATUS_LABELS.contacted },
  { key: "qualified", color: LEAD_STATUS_CHART_COLORS.qualified, label: LEAD_STATUS_LABELS.qualified },
  { key: "quotation", color: LEAD_STATUS_CHART_COLORS.quotation, label: LEAD_STATUS_LABELS.quotation },
  { key: "won", color: LEAD_STATUS_CHART_COLORS.won, label: LEAD_STATUS_LABELS.won },
];

function shortDay(date: string): string {
  return formatDate(date).replace(/ \d{4}$/, "");
}

type TotalPoint = { date: string; total: number };

function withTotal(data: LeadsTrendPoint[]): TotalPoint[] {
  return data.map((p) => ({ date: p.date, total: p.new + p.contacted + p.qualified + p.quotation + p.won }));
}

// Daily leads-created counts by current status, over the last N business
// days (see getLeadsTrend) -- real data only, no interpolation for missing
// days (a day with zero leads created just renders as 0 on every series).
//
// `simple` collapses the 5 status series into one "total leads created per
// day" area (real sum of the same 5 real fields, computed client-side, not
// a new query) -- the mobile reference shows one simplified trend line, not
// the desktop's full 5-series/legend chart shrunk down.
export function LeadsTrendChart({ data, simple = false }: { data: LeadsTrendPoint[]; simple?: boolean }) {
  const hasAny = data.some((p) => p.new + p.contacted + p.qualified + p.quotation + p.won > 0);

  if (simple) {
    const totals = withTotal(data);
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Leads Trend</h2>
        {!hasAny ? (
          <p className="mt-6 py-10 text-center text-sm text-muted-foreground">No leads created in this period yet.</p>
        ) : (
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={totals} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="leadsTrendTotalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={22} />
                <Tooltip
                  labelFormatter={(d) => formatDate(d as string)}
                  formatter={(v) => [v, "Leads"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--border)" }}
                />
                <Area type="monotone" dataKey="total" name="Leads" stroke="#16a34a" strokeWidth={2} fill="url(#leadsTrendTotalFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Leads Trend</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {!hasAny ? (
        <p className="mt-6 py-10 text-center text-sm text-muted-foreground">No leads created in this period yet.</p>
      ) : (
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} />
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
