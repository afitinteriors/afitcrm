import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export type StaffOption = {
  id: string;
  display_name: string | null;
  role: "admin" | "staff";
  active: boolean;
  telegram_username: string | null;
};

// Admin-only staff directory for the lead assignment picker. Mirrors
// profiles_select_self_or_admin RLS (self or admin) -- returns [] for a
// non-admin caller explicitly rather than relying on the database call to
// come back empty.
export async function getAssignableStaff(): Promise<StaffOption[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, active, telegram_username")
    .eq("role", "staff")
    .eq("active", true)
    .order("display_name", { ascending: true });

  if (error) return [];
  return data ?? [];
}

// Admin + staff directory for Team & Permissions. Includes deactivated
// members too (unlike getAssignableStaff) -- Blueprint Section 2:
// "A member who leaves is deactivated, never deleted ... history stays",
// so they must still be visible (with a Deactivated badge) to reactivate
// or to see their old grants, just excluded from new lead assignment.
// Mirrors profiles_select_self_or_admin RLS: returns [] for a non-admin
// caller.
export async function getAllTeamMembers(): Promise<StaffOption[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, active, telegram_username")
    .order("role", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) return [];
  return data ?? [];
}

// Resolves a single profile's display name for showing the current
// assignee. Relies on the same profiles RLS: a staff caller can only ever
// pass their own id here (the only assignee they're allowed to see per
// leads RLS); admin can resolve any profile.
export async function getProfileDisplayName(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("display_name").eq("id", id).single();
  return data?.display_name ?? null;
}
