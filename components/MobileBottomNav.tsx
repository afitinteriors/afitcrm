"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Home",
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
    href: "/conversations",
    label: "Chats",
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
    label: "Tasks",
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
    label: "Visits",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    ),
  },
];

// Primary mobile navigation -- the five real, built destinations, plus an
// optional admin-only "More" slot (Automation/Audit Log/Settings) passed in
// from the layout. Follow-ups/Tasks and Site Visits are real tabs -- §1
// lists both as mobile priorities for every role. Quotations is
// deliberately NOT here -- §1 lists "quotations" under Desktop's full CRM
// operations, not among Mobile's daily-work priorities, so it stays
// sidebar-only.
export function MobileBottomNav({ moreSlot }: { moreSlot?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-sidebar-border bg-gradient-dark-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
              active ? "text-sidebar-primary" : "text-sidebar-muted active:text-sidebar-foreground"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-6 w-6"
              aria-hidden="true"
            >
              {item.icon}
            </svg>
            {item.label}
          </Link>
        );
      })}
      {moreSlot}
    </nav>
  );
}
