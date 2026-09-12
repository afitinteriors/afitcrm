import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Canonical phone representation used everywhere a phone number is looked
// up or stored for deduplication purposes: E.164 (e.g. "+919876543210").
// Verified empirically against libphonenumber-js (not assumed) before this
// algorithm was written -- see the two branches below for exactly what was
// confirmed and why.

export type CanonicalPhoneResult =
  | { ok: true; e164: string }
  | { ok: false; reason: "empty" | "unparseable" };

// This CRM serves Indian customers today (WABIS/Meta traffic, staff-entered
// leads). India is used ONLY as an explicit, documented fallback for a
// number that carries no country signal of its own (no leading "+", no
// "00" international prefix) -- never for a number that already specifies
// a country code. This is a business-policy choice, not something
// libphonenumber-js infers on its own.
const FALLBACK_COUNTRY: CountryCode = "IN";

/**
 * Canonicalizes a phone number to E.164.
 *
 * - A number with an explicit country code (leading "+", or a "00"
 *   international dialing prefix rewritten to "+") is parsed strictly as
 *   given -- no default country is ever applied, so international numbers
 *   (+44..., +1..., +971..., ...) are never reinterpreted as Indian.
 * - A number with no country signal at all falls back to India as the
 *   default country. Verified directly against libphonenumber-js: passing
 *   defaultCountry "IN" correctly and uniformly resolves all of
 *   "919876543210" (country code, no plus), "09876543210" (national trunk
 *   prefix), and "9876543210" (bare national number) to the same
 *   "+919876543210" -- this is libphonenumber-js's own validated
 *   national-number parsing, not a hand-rolled "strip the first two
 *   digits" shortcut, and .isValid() still rejects anything that isn't a
 *   real Indian number shape.
 * - Anything that doesn't validate under either reading is reported as
 *   unparseable rather than silently stored or guessed at.
 */
export function toCanonicalPhone(raw: unknown): CanonicalPhoneResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "empty" };

  // Keep digits and a leading "+"; drop cosmetic formatting only
  // (spaces, hyphens, parentheses, dots).
  let cleaned = raw.trim().replace(/[\s\-().]/g, "");
  if (!cleaned) return { ok: false, reason: "empty" };

  if (!cleaned.startsWith("+") && cleaned.startsWith("00")) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  try {
    if (cleaned.startsWith("+")) {
      const parsed = parsePhoneNumberFromString(cleaned);
      return parsed?.isValid() ? { ok: true, e164: parsed.number } : { ok: false, reason: "unparseable" };
    }

    const parsed = parsePhoneNumberFromString(cleaned, FALLBACK_COUNTRY);
    return parsed?.isValid() ? { ok: true, e164: parsed.number } : { ok: false, reason: "unparseable" };
  } catch {
    // libphonenumber-js throws on a small class of malformed input
    // (e.g. a pathologically long digit string) rather than returning
    // undefined -- treated the same as any other unparseable input.
    return { ok: false, reason: "unparseable" };
  }
}
