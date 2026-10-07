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
// shares one JWT verification + profiles lookup instead of each repeating
// both round trips -- this was previously happening 4-5x per page load.
//
// Uses getClaims() rather than getUser(): this project's Supabase Auth uses
// asymmetric (ES256) JWT signing keys, so getClaims() verifies the access
// token's signature locally via WebCrypto instead of making a network round
// trip to the Auth server's /user endpoint. proxy.ts's middleware already
// makes that real network call once per request (auth.getUser(), to decide
// the login redirect) -- this was then repeating the same server-side
// validation a second time on every request. The profiles lookup below still
// goes through RLS with the caller's real JWT, so row-level access is
// unaffected; only the redundant second Auth-server round trip is removed.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const {
    data,
  } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", userId)
    .single();
  if (!profile) return null;

  return { id: profile.id, role: profile.role, displayName: profile.display_name };
});
