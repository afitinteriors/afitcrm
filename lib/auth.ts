"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentProfile as getCurrentProfileCached } from "@/lib/session";
import type { ProfileRole } from "@/lib/supabase/types";

export type LoginState = { error: string } | null;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeRedirectPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}

export type CurrentProfile = {
  id: string;
  role: ProfileRole;
  displayName: string | null;
};

// The actual implementation lives in lib/session.ts, memoized per-request
// with React's cache() -- this file is "use server" (Server Actions), which
// isn't the right place for a cache()-wrapped data reader. Re-exported here
// so every existing `import { getCurrentProfile } from "@/lib/auth"` keeps
// working unchanged.
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  return getCurrentProfileCached();
}
