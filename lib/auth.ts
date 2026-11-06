"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentProfile as getCurrentProfileCached } from "@/lib/session";
import { recordAuditEvent } from "@/lib/audit";
import type { ProfileRole } from "@/lib/supabase/types";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  return `${protocol}://${host}`;
}

export type LoginState = { error: string } | null;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeRedirectPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Incorrect email or password." };
  }

  await recordAuditEvent({ actorId: data.user.id, action: "login" });

  redirect(next);
}

export type ForgotPasswordState = { error: string } | { success: true } | null;

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
  });

  // Supabase never reveals whether an account exists for this email (avoids
  // user enumeration), so this always reports success regardless.
  return { success: true };
}

export type UpdatePasswordState = { error: string } | null;

export async function updatePassword(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Couldn't update your password. Try again." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await recordAuditEvent({ actorId: user.id, action: "logout" });
  }

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
