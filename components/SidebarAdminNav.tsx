import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

// Admin-only, matching /audit-log's own page-level check + RLS -- this is
// convenience visibility only, not a security boundary (AGENTS.md: never
// solve a security problem by merely hiding a button). A Server Component
// so the profile fetch can stream in via Suspense without blocking the
// rest of the sidebar (same pattern as SidebarProfileFooter).
export async function SidebarAdminNav() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return null;

  return (
    <Link
      href="/audit-log"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        className="h-5 w-5 shrink-0"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M9 12.75h4.5m-4.5 3h4.5m-9-9.75h13.5A1.5 1.5 0 0120.25 7.5v12a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-12A1.5 1.5 0 015.25 6zm3-3v3.75m7.5-3.75v3.75"
        />
      </svg>
      Audit Log
    </Link>
  );
}
