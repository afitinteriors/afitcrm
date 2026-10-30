import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getAllTeamMembers } from "@/lib/staff";
import { getAllPermissionGrants } from "@/lib/actions/team-permissions";
import { TeamPermissionsWorkspace } from "@/components/settings/TeamPermissionsWorkspace";

// Admin-only, same pattern as /settings/whatsapp-numbers. Team members,
// permission grants, invites, and deactivation are all real as of
// Blueprint Phase 1 (supabase/migrations/20261030160000_team_member_
// lifecycle.sql) -- see lib/actions/team-permissions.ts for every
// mutation.
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
