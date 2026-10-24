import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getAllTeamMembers } from "@/lib/staff";
import { TeamPermissionsWorkspace } from "@/components/settings/TeamPermissionsWorkspace";

// Admin-only, same pattern as /settings/whatsapp-numbers. UI/UX prototype
// (this phase is design-first) -- real team members come from the existing
// `profiles` table (read-only, no schema change); permission checkboxes are
// a local-only preview, see lib/settings/team-permissions.ts.
export default async function TeamSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const team = await getAllTeamMembers();

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Team &amp; Permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage who&apos;s on your team and what they can access.</p>

      <div className="mt-6">
        <TeamPermissionsWorkspace team={team} />
      </div>
    </div>
  );
}
