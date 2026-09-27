import Link from "next/link";

type Tone = "info" | "success" | "warning" | "purple" | "emerald" | "brand";
type Tile = { count: string; label: string; sublabel: string; tone: Tone; href: string };

const TONE_CLASSES: Record<Tone, { bg: string; iconBg: string; iconText: string; count: string }> = {
  info: { bg: "bg-blue-50", iconBg: "bg-blue-500/15", iconText: "text-blue-600", count: "text-blue-600" },
  success: { bg: "bg-emerald-50", iconBg: "bg-emerald-500/15", iconText: "text-emerald-600", count: "text-emerald-600" },
  warning: { bg: "bg-warning-soft", iconBg: "bg-warning/15", iconText: "text-warning", count: "text-warning" },
  purple: { bg: "bg-purple-50", iconBg: "bg-purple-500/15", iconText: "text-purple-600", count: "text-purple-600" },
  emerald: { bg: "bg-emerald-50", iconBg: "bg-emerald-500/15", iconText: "text-emerald-600", count: "text-emerald-600" },
  brand: { bg: "bg-primary/10", iconBg: "bg-primary/15", iconText: "text-primary", count: "text-primary" },
};

const ICONS: Record<Tone, string> = {
  info: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0",
  success: "M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  warning: "M9 6.75V15m6-6v8.25m.503 3.498l4.875-4.875a1.125 1.125 0 000-1.591l-9.375-9.375a1.125 1.125 0 00-1.591 0L3.622 10.5a1.125 1.125 0 000 1.591l4.875 4.875a1.125 1.125 0 001.591 0z",
  purple: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  emerald: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0",
  brand: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

// Real counts only -- every figure here comes straight from
// getDashboardStats()/getRecentLeads() upstream (Admin Dashboard reference's
// 6-tile KPI row), each linking to the real existing view that shows the
// underlying leads (never a fabricated filter).
export function AdminKpiTiles({
  totalLeads,
  newLeads,
  siteVisits,
  quotations,
  won,
  revenue,
}: {
  totalLeads: number;
  newLeads: number;
  siteVisits: number;
  quotations: number;
  won: number;
  revenue: string;
}) {
  const tiles: Tile[] = [
    { count: String(totalLeads), label: "Total Leads", sublabel: "All active leads", tone: "info", href: "/leads" },
    { count: String(newLeads), label: "New Leads", sublabel: "Not contacted yet", tone: "success", href: "/leads?status=new" },
    { count: String(siteVisits), label: "Site Visits", sublabel: "Ever scheduled", tone: "warning", href: "/site-visits" },
    { count: String(quotations), label: "Quotations", sublabel: "Ever quoted", tone: "purple", href: "/quotations" },
    { count: String(won), label: "Won Projects", sublabel: "Closed won", tone: "emerald", href: "/leads?status=won" },
    { count: revenue, label: "Revenue (Est.)", sublabel: "Won job value", tone: "brand", href: "/reports" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((tile) => {
        const tone = TONE_CLASSES[tile.tone];
        return (
          <Link
            key={tile.label}
            href={tile.href}
            className={`block min-w-0 rounded-2xl p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${tone.bg}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tone.iconBg} ${tone.iconText}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[tile.tone]} />
              </svg>
            </span>
            <p className={`mt-2 text-2xl font-bold leading-none ${tone.count}`}>{tile.count}</p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">{tile.label}</p>
            <p className="text-xs text-muted-foreground">{tile.sublabel}</p>
          </Link>
        );
      })}
    </div>
  );
}
