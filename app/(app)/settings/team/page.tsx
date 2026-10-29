import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getAllTeamMembers } from "@/lib/staff";
import { getAllPermissionGrants } from "@/lib/actions/team-permissions";
import { TeamPermissionsWorkspace } from "@/components/settings/TeamPermissionsWorkspace";

// Admin-only, same pattern as /settings/whatsapp-numbers. Real team members
// come from the existing `profiles` table (read-only, no schema change);
// their permission grants now come from the real profile_permissions table
// (supabase/migrations/20261029140000_profile_permissions.sql) -- see
// lib/settings/team-permissions.ts's header comment for what's still a
// local-only preview (adding a brand-new member/account).
export default async function TeamSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const [team, grants] = await Promise.all([getAllTeamMembers(), getAllPermissionGrants()]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Team &amp; Permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage who&apos;s on your team and what they can access.</p>

      <div className="mt-6">
        <TeamPermissionsWorkspace team={team} grants={grants} />
      </div>
    </div>
  );
}
