"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  staff: "Staff",
};

// Header avatar + name/role + dropdown (Notifications, Sign out). Same
// account actions SidebarProfileFooter already exposes, just reachable from
// the header too -- no new account behavior, no change to that component.
//
// `dark` renders it for the mobile slim bar's dark gradient background
// (same sidebar-* tokens Sidebar/MobileMoreMenu already use there) instead
// of the light desktop header's card/foreground tokens -- text-foreground
// on that dark bar was unreadable (near-invisible) before this was added.
export function HeaderAccountMenu({ displayName, role, dark = false }: { displayName: string | null; role: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = (displayName ?? "?").charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dark ? "hover:bg-sidebar-accent" : "hover:bg-muted"}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initial}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className={`block truncate text-sm font-semibold leading-tight ${dark ? "text-sidebar-foreground" : "text-foreground"}`}>
            {displayName ?? "Unknown user"}
          </span>
          <span className={`block truncate text-xs leading-tight ${dark ? "text-sidebar-muted" : "text-muted-foreground"}`}>
            {ROLE_LABELS[role] ?? role}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`hidden h-4 w-4 shrink-0 sm:block ${dark ? "text-sidebar-muted" : "text-muted-foreground"}`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account menu"
          className={
            dark
              ? "absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-sidebar-border bg-gradient-dark-bg py-1.5 shadow-lg"
              : "absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-lg"
          }
        >
          <Link
            href="/notifications"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={`block px-4 py-2.5 text-sm font-medium ${dark ? "text-sidebar-foreground hover:bg-sidebar-accent" : "text-foreground hover:bg-muted"}`}
          >
            Notifications
          </Link>
          <div className={`mx-4 my-1 border-t ${dark ? "border-sidebar-border" : "border-border"}`} />
          <div className="px-2">
            <SignOutButton
              className={`block w-full rounded-lg px-2 py-2.5 text-left text-sm font-medium disabled:opacity-60 ${
                dark ? "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
