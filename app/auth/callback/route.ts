import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeRedirectPath } from "@/lib/safe-redirect";

export const runtime = "nodejs";

// Single callback for every Supabase PKCE code-exchange link: password
// recovery (Forgot Password) today, and Google OAuth once that's wired up.
// Both land here with a `code` param; `next` tells them apart.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(searchParams.get("next") ?? "/dashboard");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Password-recovery links always carry next=/auth/update-password. Anyone
  // who reaches this point by definition already has an account (Supabase
  // only emails a recovery link to an address that has one), so the
  // pre-approval gate below -- which exists only to stop an unapproved
  // Gmail account getting in via a future "Continue with Google" button --
  // doesn't apply to this flow.
  if (next.startsWith("/auth/update-password")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // OAuth gate: this CRM has no self-signup. An account only has real
  // access if an admin already added them as a team member (which creates
  // this profiles row) -- see lib/actions/team-permissions.ts. A Google
  // sign-in that doesn't match an existing profile is rejected outright,
  // not left in some pending state.
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", data.user.id).maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_authorized`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
