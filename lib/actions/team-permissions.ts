"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import { PERMISSION_GROUPS } from "@/lib/settings/team-permissions";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";
import type { PermissionKey, ProfileRole } from "@/lib/supabase/types";

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


export type InviteTeamMemberInput = {
  name: string;
  email: string;
  role: ProfileRole;
  telegramUsername?: string;
};
export type InviteTeamMemberResult = { ok: true } | { error: string };

// Real account creation, via Supabase Auth's Admin API -- the one part of
// this flow that is inherently service-role-only (no RLS policy can grant
// "create another user's login," that's an Auth-level operation, not a
// public-schema table write). createAdminClient() is used for exactly this
// one call; the profiles row insert right after it goes through the normal
// RLS-respecting client and the new profiles_insert_admin_only policy
// (supabase/migrations/20261030160000_team_member_lifecycle.sql), so RLS
// stays the real security boundary for the data itself, same as every
// other table in this app.
export async function inviteTeamMember(input: InviteTeamMemberInput): Promise<InviteTeamMemberResult> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admin access required." };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const telegramUsername = input.telegramUsername?.trim() || null;
  if (!name) return { error: "Enter a name." };
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (input.role !== "admin" && input.role !== "staff") return { error: "Invalid role." };

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited?.user) {
    return { error: inviteError?.message ?? "Could not invite this email." };
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: invited.user.id,
    role: input.role,
    display_name: name,
    telegram_username: telegramUsername,
  });
  if (profileError) {
    // The auth user now exists without a profiles row -- surface this
    // plainly rather than silently leaving a half-created account; an
    // admin can retry by inviting the same email again once the cause
    // (e.g. a transient DB error) is fixed, since inviteUserByEmail on an
    // email that already exists in auth.users resends the invite instead
    // of erroring.
    return { error: "Account created but the team profile could not be saved. Try inviting this email again." };
  }

  await recordAuditEvent({
    actorId: profile.id,
    action: "team_member_invited",
    targetType: "profile",
    targetId: invited.user.id,
    metadata: { role: input.role },
  });

  revalidateTeamPage();
  return { ok: true };
}

export type DeactivateTeamMemberResult = { ok: true; reassignedLeadCount: number } | { error: string };

// Never deletes -- Blueprint Section 2: "A member who leaves is
// deactivated, never deleted; their leads are reassigned and history
// stays." Their open leads (OPEN_LEAD_STATUSES -- won/lost/invalid are
// closed, not reassigned) move to reassignToId, or are left unassigned if
// omitted; getAssignableStaff() already excludes inactive staff so they
// stop receiving new leads immediately.
//
// `active = false` on its own only gates this app's own pages
// (getCurrentProfile() in lib/session.ts fails closed on it) -- existing
// RLS policies project-wide check admin-or-self, not `active`, same as
// every other table (CLAUDE.md "Auth / RLS / Security": that shape is
// deliberate and not being touched here). A deactivated member must
// actually lose access, not just lose the UI, so this also bans their
// Supabase Auth account via the Admin API (the correct, narrow way to
// revoke one user's access -- it invalidates their existing sessions too
// -- rather than retrofitting `active` into every RLS policy in the
// project for this one phase).
export async function deactivateTeamMember(profileId: string, reassignToId: string | null): Promise<DeactivateTeamMemberResult> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admin access required." };
  if (!profileId) return { error: "Missing team member." };
  if (profileId === profile.id) return { error: "You can't deactivate your own account." };

  const supabase = await createClient();

  const { error: deactivateError } = await supabase.from("profiles").update({ active: false }).eq("id", profileId);
  if (deactivateError) return { error: "Could not deactivate this member." };

  const admin = createAdminClient();
  const { error: banError } = await admin.auth.admin.updateUserById(profileId, { ban_duration: "876000h" });
  if (banError) {
    // Roll back the flag rather than leave "active = false" but still able
    // to sign in -- a deactivated-looking member who can still log in is
    // worse than this action simply failing.
    await supabase.from("profiles").update({ active: true }).eq("id", profileId);
    return { error: "Could not revoke this member's sign-in access. Nothing was changed." };
  }

  const { data: reassigned, error: reassignError } = await supabase
    .from("leads")
    .update({ assigned_to_id: reassignToId })
    .eq("assigned_to_id", profileId)
    .in("status", OPEN_LEAD_STATUSES)
    .select("id");
  if (reassignError) return { error: "Deactivated, but reassigning their open leads failed. Reassign them manually." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "team_member_deactivated",
    targetType: "profile",
    targetId: profileId,
    metadata: { reassigned_to: reassignToId, reassigned_lead_count: reassigned?.length ?? 0 },
  });

  revalidateTeamPage();
  return { ok: true, reassignedLeadCount: reassigned?.length ?? 0 };
}

export async function reactivateTeamMember(profileId: string): Promise<SetPermissionResult> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admin access required." };
  if (!profileId) return { error: "Missing team member." };

  const admin = createAdminClient();
  const { error: unbanError } = await admin.auth.admin.updateUserById(profileId, { ban_duration: "none" });
  if (unbanError) return { error: "Could not restore this member's sign-in access." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active: true }).eq("id", profileId);
  if (error) return { error: "Could not reactivate this member." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "team_member_reactivated",
    targetType: "profile",
    targetId: profileId,
  });

  revalidateTeamPage();
  return { ok: true };
}

export async function setTelegramUsername(profileId: string, telegramUsername: string): Promise<SetPermissionResult> {
  const profile = await requireAdmin();
  if (!profile) return { error: "Admin access required." };
  if (!profileId) return { error: "Missing team member." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ telegram_username: telegramUsername.trim() || null })
    .eq("id", profileId);
  if (error) return { error: "Could not save the Telegram username." };

  await recordAuditEvent({
    actorId: profile.id,
    action: "setting_changed",
    targetType: "setting",
    targetId: profileId,
    metadata: { field: "telegram_username" },
  });

  revalidateTeamPage();
  return { ok: true };
}
