import Link from "next/link";

// Real activity only -- calls/whatsapp/estimates come from
// getTodayActivityCounts() (lib/dashboard-brain.ts; its own comments
// explain exactly what each one counts and why), siteVisitsToday and the
// follow-up done/pending/target figures are plain counts of already-
// fetched real rows. No invented daily quota.
export function StaffTodayProgress({
  done,
  pending,
  target,
  calls,
  whatsapp,
  siteVisitsToday,
  estimates,
}: {
  done: number;
  pending: number;
  target: number;
  calls: number;
  whatsapp: number;
  siteVisitsToday: number;
  estimates: number;
}) {
  const pct = target > 0 ? Math.round((done / target) * 100) : 100;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  const tiles = [
    {
      value: calls,
      label: "Calls",
      iconBg: "bg-emerald-100 text-emerald-600",
      icon: (
        <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
      ),
    },
    {
      value: whatsapp,
      label: "WhatsApp",
      iconBg: "bg-emerald-100 text-emerald-600",
      icon: (
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a8.5 8.5 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      ),
      fill: true,
    },
    {
      value: siteVisitsToday,
      label: "Site Visits",
      iconBg: "bg-purple-100 text-purple-600",
      icon: (
        <>
          <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </>
      ),
    },
    {
      value: estimates,
      label: "Estimates",
      iconBg: "bg-blue-100 text-blue-600",
      icon: (
        <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      ),
    },
  ];

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

      {/* Desktop: ring + follow-up breakdown */}
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

      {/* Mobile: today's real activity -- calls, WhatsApp, site visits, estimates */}
      <div className="mt-3 grid grid-cols-4 gap-2 lg:hidden">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-1.5 text-center">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${t.iconBg}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill={t.fill ? "currentColor" : "none"} stroke={t.fill ? "none" : "currentColor"} strokeWidth={1.75} className="h-4 w-4">
                {t.icon}
              </svg>
            </span>
            <p className="text-base font-bold leading-none text-foreground">{t.value}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
