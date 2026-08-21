import Link from "next/link";
import { getCurrentUserEmail } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const email = await getCurrentUserEmail();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-slate-900">
              AFIT Leads CRM
            </Link>
            <nav className="hidden items-center gap-4 sm:flex">
              <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
                Dashboard
              </Link>
              <Link href="/leads" className="text-sm text-slate-600 hover:text-slate-900">
                Leads
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/leads/new"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              New Lead
            </Link>
            {email && <span className="hidden text-sm text-slate-500 sm:inline">{email}</span>}
            <SignOutButton />
          </div>
        </div>
        <nav className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 sm:hidden">
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
            Dashboard
          </Link>
          <Link href="/leads" className="text-sm text-slate-600 hover:text-slate-900">
            Leads
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
