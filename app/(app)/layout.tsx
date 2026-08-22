import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar profile={profile} />

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
