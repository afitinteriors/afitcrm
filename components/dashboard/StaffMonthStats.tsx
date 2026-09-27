import Link from "next/link";

// "This Month": Total Leads is exact (created_at within the current
// business-zone month). Site Visits uses the real site_visit_date field.
// Quotations/Won are approximated by "last updated this month" since no
// dedicated stage-transition timestamp exists yet (see lib/leads.ts's
// getStaffOverview doc comment) -- still real rows, not fabricated numbers.
export function StaffMonthStats({
  totalLeads,
  siteVisits,
  quotations,
  won,
}: {
  totalLeads: number;
  siteVisits: number;
  quotations: number;
  won: number;
}) {
  const stats = [
    { value: totalLeads, label: "Total Leads", tone: "text-foreground" },
    { value: siteVisits, label: "Site Visits", tone: "text-blue-600" },
    { value: quotations, label: "Quotations", tone: "text-purple-600" },
    { value: won, label: "Won Deals", tone: "text-emerald-600" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 text-primary" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4.5-4.5 4.5 4.5 7.5-7.5M3 20.25h18" />
          </svg>
          This Month
        </h3>
        <Link href="/reports" className="text-xs font-semibold text-primary hover:underline">
          View report
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className={`text-xl font-bold leading-none ${s.tone}`}>{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
