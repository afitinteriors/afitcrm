import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session cookie on every request and redirects
// unauthenticated users away from protected routes. Invoked from proxy.ts.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  // Reachable without a session: /login and /forgot-password obviously, but
  // also /auth/callback (it's what *establishes* the session -- requiring
  // one first would make the redirect link from Supabase/Google unusable)
  // and /auth/update-password (reached via a short-lived recovery session
  // from that same callback, not a normal logged-in state).
  const isPublicPath = pathname === "/login" || pathname === "/forgot-password" || pathname.startsWith("/auth/");
  // Only bounce an *already* logged-in user away from the login/forgot-
  // password forms -- not from /auth/update-password, which a logged-in-
  // via-recovery user is supposed to land on.
  const isGuestOnlyPath = pathname === "/login" || pathname === "/forgot-password";

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isGuestOnlyPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
