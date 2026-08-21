import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - static assets (svg, png, jpg, jpeg, gif, webp, ico)
     * - api/webhooks (external callbacks with no staff session, e.g. Meta;
     *   these must never be redirected to /login)
     */
    "/((?!_next/static|_next/image|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
