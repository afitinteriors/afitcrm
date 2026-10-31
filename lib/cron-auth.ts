import "server-only";
import { timingSafeEqual } from "node:crypto";

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically when
// the project has a CRON_SECRET env var configured -- this is the only
// credential a cron route has (same reasoning as lib/whatsapp/wabis-auth.ts's
// isValidWabisSecret for the WABIS webhook: no signature scheme of its own,
// so a constant-time compare against the configured secret is the whole
// check). Shared across every /api/cron/* route rather than re-implemented
// per route.
export function isValidCronSecret(authorizationHeader: string | null, expected: string | undefined): boolean {
  if (!expected || !authorizationHeader) return false;

  const candidate = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7) : authorizationHeader;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
