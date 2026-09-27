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
];

// Primary mobile navigation -- Home / Tasks / Leads, plus a real "More"
// slot rendered for every role via MobileMoreEntry/MobileMoreMenu, not an
// admin-only gate (dashboard reference redesign, 2026-09-27). Chats
// (Conversations) moved into More's "Work" section alongside Site Visits/
// Deals/Quotations rather than staying a dedicated tab, so it's still one
// tap away, just not a 4th bottom slot -- matches the approved reference's
// bottom-bar composition. Automation/Audit Log/Settings stay entirely out
// of this primary bar (Management/System sections inside More, admin-only).
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
