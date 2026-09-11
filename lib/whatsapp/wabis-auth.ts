import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison of the WABIS webhook's URL-path secret against
 * the configured value. WABIS's outbound webhook has no signature, header,
 * or API-key mechanism of its own (confirmed against the live account) —
 * this high-entropy path segment is the only credential available.
 */
export function isValidWabisSecret(candidate: string | undefined, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
