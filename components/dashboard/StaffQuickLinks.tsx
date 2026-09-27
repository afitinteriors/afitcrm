import Link from "next/link";

const LINKS = [
  { href: "/follow-ups", label: "My Calendar", sublabel: "All follow-ups", tone: "bg-violet-100 text-violet-700", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
  { href: "/site-visits", label: "Site Visits", sublabel: "Upcoming visits", tone: "bg-blue-100 text-blue-700", icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" },
  { href: "/quotations", label: "My Quotations", sublabel: "Draft & sent", tone: "bg-emerald-100 text-emerald-700", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { href: "/reports", label: "My Performance", sublabel: "Targets & stats", tone: "bg-orange-100 text-orange-700", icon: "M3 13.5l4.5-4.5 4.5 4.5 7.5-7.5M3 20.25h18" },
];

// Real existing routes only ("My Performance" -> /reports, the closest
// existing targets/stats surface; there is no dedicated per-staff
// performance page).
export function StaffQuickLinks() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 text-warning" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
        Quick Links
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="min-w-0 rounded-xl border border-border p-2.5 transition-colors hover:bg-muted/60">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${link.tone}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
              </svg>
            </span>
            <span className="mt-1.5 block truncate text-xs font-semibold text-foreground">{link.label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{link.sublabel}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
