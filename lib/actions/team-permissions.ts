"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { PERMISSION_GROUPS } from "@/lib/settings/team-permissions";
import type { PermissionKey } from "@/lib/supabase/types";

// Admin-only for every mutation here -- profile_permissions RLS
// (profile_permissions_write_admin_only) already enforces this
// independently; this is the same explicit application-level check used
// throughout this app, not a substitute for it.
async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

function revalidateTeamPage() {
  revalidatePath("/settings/team");
}

const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
function isPermissionKey(value: string): value is PermissionKey {
  return (ALL_PERMISSION_KEYS as string[]).includes(value);
}

// Every granted permission for every real team member, as
// { [profileId]: Set<PermissionKey> } -- the shape TeamPermissionsWorkspace
// already keeps its own local `permissions` state in, so the only change
// on the client is where that initial value comes from. Admin-only in
// practice (profile_permissions RLS lets a non-admin read only their own
// row, which this function doesn't need); returns {} for a non-admin
// caller explicitly, same convention as getAllTeamMembers().
export async function getAllPermissionGrants(): Promise<Record<string, PermissionKey[]>> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return {};

  const supabase = await createClient();
  const { data, error } = await supabase.from("profile_permissions").select("profile_id, permission_key");
  if (error) return {};

  const grants: Record<string, PermissionKey[]> = {};
  for (const row of data ?? []) {
    (grants[row.profile_id] ??= []).push(row.permission_key);
  }
  return grants;
}

export type SetPermissionResult = { ok: true } | { error: string };

// One checkbox toggle = one call. Idempotent either direction (granting an
// already-granted permission, or revoking one that's already absent, both
// succeed as a no-op) so a client double-click or a stale UI state can
// never error.
export async function setPermissionGrant(
  profileId: string,
  permissionKey: string,
  granted: boolean,
): Promise<SetPermissionResult> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admin access required." };
  if (!profileId) return { error: "Missing team member." };
  if (!isPermissionKey(permissionKey)) return { error: "Unknown permission." };

  const supabase = await createClient();

  if (granted) {
    const { error } = await supabase
      .from("profile_permissions")
      .upsert({ profile_id: profileId, permission_key: permissionKey, granted_by: profile.id }, { onConflict: "profile_id,permission_key" });
    if (error) return { error: "Could not grant this permission." };
  } else {
    const { error } = await supabase
      .from("profile_permissions")
      .delete()
      .eq("profile_id", profileId)
      .eq("permission_key", permissionKey);
    if (error) return { error: "Could not revoke this permission." };
  }

  await recordAuditEvent({
    actorId: profile.id,
    action: "setting_changed",
    targetType: "setting",
    targetId: profileId,
    metadata: { field: "permission", permission_key: permissionKey, granted },
  });

  revalidateTeamPage();
  return { ok: true };
}
