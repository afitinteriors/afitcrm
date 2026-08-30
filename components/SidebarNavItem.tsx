"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Shared by Sidebar.tsx's primary nav and SidebarAdminNav.tsx's admin nav so
// both sections get identical active-state detection and styling. A client
// leaf so SidebarAdminNav can stay an async Server Component (the profile
// fetch keeps streaming via Suspense) while still knowing the current route.
export function SidebarNavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
          : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="h-5 w-5 shrink-0"
        aria-hidden="true"
      >
        {icon}
      </svg>
      {label}
    </Link>
  );
}
