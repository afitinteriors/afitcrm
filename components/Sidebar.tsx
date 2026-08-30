import { BuildingEmblem } from "@/components/BuildingEmblem";
import { SidebarNavItem } from "@/components/SidebarNavItem";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3.75 12l8.25-8.25L20.25 12M5.25 10.5V20a.75.75 0 00.75.75h4.5v-5.25h3V20.75h4.5a.75.75 0 00.75-.75v-9.5"
      />
    ),
  },
  {
    href: "/leads",
    label: "Leads",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0"
      />
    ),
  },
  {
    href: "/deals",
    label: "Deals",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
      />
    ),
  },
  {
    href: "/conversations",
    label: "Conversations",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    ),
  },
  {
    href: "/follow-ups",
    label: "Follow-ups",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  {
    href: "/site-visits",
    label: "Site Visits",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    ),
  },
  {
    href: "/quotations",
    label: "Quotations",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    ),
  },
];

export function Sidebar({ footer, adminNav }: { footer: React.ReactNode; adminNav?: React.ReactNode }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-gradient-dark-bg lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <BuildingEmblem className="h-8 w-8 shrink-0" />
        <div className="min-w-0 font-brand leading-tight">
          <p className="text-sm font-bold tracking-tight text-sidebar-foreground">AFIT</p>
          <p className="text-[11px] font-medium tracking-wide text-sidebar-muted">Business OS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}
        {adminNav}
      </nav>

      <div className="border-t border-sidebar-border p-3">{footer}</div>
    </aside>
  );
}
