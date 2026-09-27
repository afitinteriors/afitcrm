import Link from "next/link";

type Action = { href: string; label: string; sublabel: string; icon: string; tone: string };

// Real navigation shortcuts to existing modules only -- "Call"/"WhatsApp"
// quick-dial tiles from the reference are not included because they have no
// real target without a specific lead selected first (dialling is already a
// per-lead action on every lead card below); these four are actual existing
// routes instead of a fabricated generic dial/chat action.
const ACTIONS: Action[] = [
  {
    href: "/leads/new",
    label: "Add Lead",
    sublabel: "New enquiry",
    tone: "bg-primary text-primary-foreground",
    icon: "M12 4.5v15m7.5-7.5h-15",
  },
  {
    href: "/site-visits",
    label: "Site Visit",
    sublabel: "Schedule visit",
    tone: "bg-violet-100 text-violet-700",
    icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  },
  {
    href: "/quotations",
    label: "Quotation",
    sublabel: "Create estimate",
    tone: "bg-orange-100 text-orange-700",
    icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  },
  {
    href: "/deals",
    label: "Deals",
    sublabel: "Active pipeline",
    tone: "bg-blue-100 text-blue-700",
    icon: "M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  },
];

export function StaffQuickActions() {
  return (
    <div>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/60 lg:justify-between"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${action.tone}`} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d={action.icon} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{action.label}</span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">{action.sublabel}</span>
              </span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="hidden h-4 w-4 shrink-0 text-muted-foreground/70 lg:block" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
