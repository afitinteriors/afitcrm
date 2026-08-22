import Link from "next/link";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProfileFooter } from "@/components/SidebarProfileFooter";
import { SidebarAdminNav } from "@/components/SidebarAdminNav";
import { SignOutButton } from "@/components/SignOutButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";

function SidebarFooterSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-lg px-2 py-2">
      <div className="h-9 w-9 shrink-0 rounded-full bg-slate-700" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3.5 w-24 rounded bg-slate-700" />
        <div className="h-3 w-16 rounded bg-slate-800" />
      </div>
    </div>
  );
}

// Not async, and doesn't call getCurrentProfile() -- middleware already
// enforces authentication before any request reaches here. The only thing
// that ever needed profile data was the sidebar's name/role footer, which
// now streams in via Suspense instead of blocking the entire shell (nav
// links, header, main slot) behind that fetch on every navigation.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        adminNav={
          <Suspense fallback={null}>
            <SidebarAdminNav />
          </Suspense>
        }
        footer={
          <Suspense fallback={<SidebarFooterSkeleton />}>
            <SidebarProfileFooter />
          </Suspense>
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile: slim brand/account bar. Primary navigation lives in the
            fixed bottom nav instead -- this isn't the nav anymore. */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 lg:hidden">
          <span className="text-sm font-semibold text-white">AFIT CRM</span>
          <SignOutButton className="text-xs font-medium text-slate-400 hover:text-white" />
        </div>

        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Link
            href="/leads/new"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + New Lead
          </Link>
        </header>

        <main className="flex-1 px-4 pb-20 pt-4 sm:px-6 lg:pb-6 lg:pt-6">{children}</main>

        <MobileBottomNav />
      </div>
    </div>
  );
}
