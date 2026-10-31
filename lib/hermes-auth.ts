import "server-only";
import { timingSafeEqual } from "node:crypto";

// Blueprint V1 Section 9 (docs/BLUEPRINT_V1.md): "Connection to CRM: an AFIT
// CRM tool server (MCP) with a fixed tool list and its own limited API key."
// The /api/hermes/* routes are that tool server -- this is their only
// credential, deliberately separate from both the Supabase service role key
// (Hermes never gets direct database access, per Section 9's "Tools Hermes
// never gets") and CRON_SECRET (a different caller with a different, much
// larger surface). Same constant-time Bearer-token comparison as
// lib/cron-auth.ts's isValidCronSecret -- not reused directly so each
// caller's credential stays independently rotatable and each file's name
// documents which caller it gates.
export function isValidHermesApiKey(authorizationHeader: string | null, expected: string | undefined): boolean {
  if (!expected || !authorizationHeader) return false;

  const candidate = authorizationHeader.startsWith("Bearer ") ? authorizationHeader.slice(7) : authorizationHeader;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
