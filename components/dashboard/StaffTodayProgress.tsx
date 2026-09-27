import Link from "next/link";

// Real progress only: "done"/"pending"/"target" come from
// getTodayFollowUpProgress() (follow_ups due today, RLS-scoped), and
// siteVisitsToday/newLeadsToday are plain counts of already-fetched real
// rows -- no fabricated daily quota, no invented call/message counters (this
// CRM has no call telemetry -- see CLAUDE.md's Calling scope rule).
export function StaffTodayProgress({
  done,
  pending,
  target,
  siteVisitsToday,
  newLeadsToday,
}: {
  done: number;
  pending: number;
  target: number;
  siteVisitsToday: number;
  newLeadsToday: number;
}) {
  const pct = target > 0 ? Math.round((done / target) * 100) : 100;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 text-primary" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-1.5a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Today&rsquo;s Progress
        </h3>
        <Link href="/follow-ups" className="text-xs font-semibold text-primary hover:underline">
          View details
        </Link>
      </div>

      {/* Desktop: ring + breakdown list */}
      <div className="mt-3 hidden items-center gap-5 lg:flex">
        <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className="text-primary"
          />
          <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-foreground text-[22px] font-bold" style={{ transformOrigin: "50px 50px" }}>
            {done}
          </text>
        </svg>
        <div className="flex-1 space-y-1.5 text-sm">
          <p className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />Follow-ups done</span>
            <span className="font-semibold text-foreground">{done}</span>
          </p>
          <p className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" />Pending</span>
            <span className="font-semibold text-foreground">{pending}</span>
          </p>
          <p className="flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-muted-foreground">Due today</span>
            <span className="font-semibold text-foreground">{target}</span>
          </p>
        </div>
      </div>

      {/* Mobile: compact real-metric tiles (no call/message counters -- not tracked) */}
      <div className="mt-3 grid grid-cols-4 gap-2 lg:hidden">
        {[
          { value: done, label: "Done" },
          { value: pending, label: "Pending" },
          { value: siteVisitsToday, label: "Site Visits" },
          { value: newLeadsToday, label: "New Leads" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl bg-muted/40 p-2 text-center">
            <p className="text-lg font-bold text-foreground">{m.value}</p>
            <p className="text-[11px] text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
