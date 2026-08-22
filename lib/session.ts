import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/supabase/types";

export type CurrentProfile = {
  id: string;
  role: ProfileRole;
  displayName: string | null;
};

// Resolves the logged-in user's ownership/role identity from public.profiles.
// Fails closed to null (no session, or no profile row yet) -- callers must
// treat null as "no access," never as an implicit role.
//
// Wrapped in React's cache() so that within a single request, every caller
// (layouts, pages, data-fetching helpers) that needs the current profile
// shares one auth.getUser() + profiles lookup instead of each repeating both
// round trips -- this was previously happening 4-5x per page load.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { id: profile.id, role: profile.role, displayName: profile.display_name };
});
