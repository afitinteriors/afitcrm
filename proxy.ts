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
     * - PWA assets (manifest.webmanifest, sw.js) -- must load without a session
     * - api/webhooks (external callbacks with no staff session, e.g. Meta;
     *   these must never be redirected to /login)
     * - api/cron (Vercel Cron invocations -- no staff session either; its
     *   own CRON_SECRET bearer-token check, not this middleware, is the
     *   real guard -- see lib/cron-auth.ts)
     * - api/hermes (Blueprint V1 Phase 5's CRM tool server -- Hermes has no
     *   staff session either; its own HERMES_API_KEY bearer-token check,
     *   not this middleware, is the real guard -- see lib/hermes-auth.ts)
     */
    "/((?!_next/static|_next/image|api/webhooks|api/cron|api/hermes|manifest\\.webmanifest$|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
