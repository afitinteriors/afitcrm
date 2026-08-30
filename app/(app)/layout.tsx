import Link from "next/link";
import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SidebarProfileFooter } from "@/components/SidebarProfileFooter";
import { SidebarAdminNav } from "@/components/SidebarAdminNav";
import { SignOutButton } from "@/components/SignOutButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileMoreEntry } from "@/components/MobileMoreEntry";
import { BuildingEmblem } from "@/components/BuildingEmblem";

function SidebarFooterSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-lg px-2 py-2">
      <div className="h-9 w-9 shrink-0 rounded-full bg-sidebar-accent" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3.5 w-24 rounded bg-sidebar-accent" />
        <div className="h-3 w-16 rounded bg-sidebar-accent/60" />
      </div>
    </div>
  );
}

// Not async, and doesn't call getCurrentProfile() -- middleware already
// enforces authentication before any request reaches here. The only things
// that ever needed profile data were the sidebar's name/role footer and the
// admin-only nav entries, which stream in via Suspense instead of blocking
// the entire shell (nav links, header, main slot) behind that fetch on
// every navigation.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen bg-background">
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
        <div className="flex items-center justify-between border-b border-sidebar-border bg-gradient-dark-bg px-4 py-3 lg:hidden">
          <span className="flex items-center gap-2">
            <BuildingEmblem className="h-5 w-5 shrink-0" />
            <span className="font-brand text-sm font-semibold text-sidebar-foreground">AFIT CRM</span>
          </span>
          <SignOutButton className="text-xs font-medium text-sidebar-muted hover:text-sidebar-foreground" />
        </div>

        <header className="flex items-center justify-end border-b border-border bg-card px-4 py-3 sm:px-6">
          <Link
            href="/leads/new"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + New Lead
          </Link>
        </header>

        <main className="flex-1 px-4 pb-20 pt-4 sm:px-6 lg:pb-6 lg:pt-6">{children}</main>

        <MobileBottomNav
          moreSlot={
            <Suspense fallback={null}>
              <MobileMoreEntry />
            </Suspense>
          }
        />
      </div>
    </div>
  );
}
