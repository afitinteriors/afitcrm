import Link from "next/link";
import { getUnreadNotificationCount } from "@/lib/notifications/unread-count";

// Read-only bell + real unread badge, linking to the existing /notifications
// page. Does not touch the Notifications feature itself (opt-in flow, push
// delivery, read/unread logic) -- only reads the count. `dark` matches the
// mobile slim bar's dark gradient background (see HeaderAccountMenu).
export async function HeaderNotificationBell({ dark = false }: { dark?: boolean }) {
  const count = await getUnreadNotificationCount();

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        dark ? "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
