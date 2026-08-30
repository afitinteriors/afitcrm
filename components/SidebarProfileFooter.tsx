import { getCurrentProfile } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  staff: "Staff",
};

// Split out from Sidebar so the nav links (which don't need profile data)
// can render immediately -- this is the only part of the shell gated behind
// getCurrentProfile(), wrapped in Suspense by the layout.
export async function SidebarProfileFooter() {
  const profile = await getCurrentProfile();

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
          {(profile?.displayName ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {profile?.displayName ?? "Unknown user"}
          </p>
          <p className="truncate text-xs text-sidebar-muted">
            {profile ? (ROLE_LABELS[profile.role] ?? profile.role) : ""}
          </p>
        </div>
      </div>
      <div className="mt-1 px-2">
        <SignOutButton className="text-xs font-medium text-sidebar-muted transition-colors hover:text-sidebar-foreground disabled:opacity-60" />
      </div>
    </>
  );
}
