import { getCurrentProfile } from "@/lib/auth";
import { SidebarNavItem } from "@/components/SidebarNavItem";

// Admin-only, matching /audit-log's own page-level check + RLS -- this is
// convenience visibility only, not a security boundary (AGENTS.md: never
// solve a security problem by merely hiding a button). A Server Component
// so the profile fetch can stream in via Suspense without blocking the
// rest of the sidebar (same pattern as SidebarProfileFooter).
export async function SidebarAdminNav() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return null;

  return (
    <div className="mt-6 border-t border-sidebar-border pt-4">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-muted">
        Admin
      </p>
      <div className="space-y-1">
        <SidebarNavItem
          href="/automation"
          label="Automation"
          icon={
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </>
          }
        />
        <SidebarNavItem
          href="/audit-log"
          label="Audit Log"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M9 12.75h4.5m-4.5 3h4.5m-9-9.75h13.5A1.5 1.5 0 0120.25 7.5v12a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-12A1.5 1.5 0 015.25 6zm3-3v3.75m7.5-3.75v3.75"
            />
          }
        />
      </div>
    </div>
  );
}
