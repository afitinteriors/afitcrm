import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request
 * body. Must be called with the exact raw bytes/string Meta hashed —
 * parsing the body as JSON first and re-stringifying it will not match.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const provided = Buffer.from(signatureHeader.slice(SIGNATURE_PREFIX.length), "hex");
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"), "hex");

  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
