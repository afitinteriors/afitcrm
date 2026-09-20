import "server-only";

// VAPID configuration for server-side Web Push. Everything here reads the
// server environment only. The validator reports a SYMBOLIC failure code and
// nothing else: no configured value (key, subject, or any fragment of one) is
// ever placed in a result, error or log line, so the code is safe to show to a
// signed-in user or write to logs.

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export const VAPID_CONFIG_ERRORS = [
  "VAPID_PUBLIC_KEY_MISSING",
  "VAPID_PUBLIC_KEY_INVALID_FORMAT",
  "VAPID_PRIVATE_KEY_MISSING",
  "VAPID_PRIVATE_KEY_INVALID_FORMAT",
  "VAPID_SUBJECT_MISSING",
  "VAPID_SUBJECT_INVALID_WHITESPACE",
  "VAPID_SUBJECT_INVALID_FORMAT",
  "VAPID_SUBJECT_PLACEHOLDER",
] as const;

export type VapidConfigError = (typeof VAPID_CONFIG_ERRORS)[number];

export type VapidConfigResult = { ok: true; config: VapidConfig } | { ok: false; reason: VapidConfigError };

const BASE64URL = /^[A-Za-z0-9_-]+$/;

// Length of the decoded bytes of an unpadded base64url string.
function decodedLength(base64url: string): number {
  return Math.floor((base64url.length * 3) / 4);
}

// A P-256 VAPID public key is an uncompressed EC point (65 bytes -> 87
// base64url chars); the private key is the 32-byte scalar (43 chars).
function isValidKey(value: string, bytes: number): boolean {
  return BASE64URL.test(value) && decodedLength(value) === bytes;
}

// The subject is the contact address push services can use to reach the
// operator. It must be a real mailto: or https: URL -- the placeholder set
// while bootstrapping (an @afit.example address) must be replaced before any
// real push is sent.
function isPlaceholderSubject(subject: string): boolean {
  return (
    /@([a-z0-9-]+\.)*example(\.[a-z]+)?$/i.test(subject) ||
    /^https?:\/\/([a-z0-9-]+\.)*example(\.[a-z]+)?(\/|$)/i.test(subject)
  );
}

export function getVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfigResult {
  // Leading/trailing whitespace (a stray newline from pasting) is tolerated;
  // whitespace INSIDE the subject is not.
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();

  if (!publicKey) return { ok: false, reason: "VAPID_PUBLIC_KEY_MISSING" };
  if (!isValidKey(publicKey, 65)) return { ok: false, reason: "VAPID_PUBLIC_KEY_INVALID_FORMAT" };
  if (!privateKey) return { ok: false, reason: "VAPID_PRIVATE_KEY_MISSING" };
  if (!isValidKey(privateKey, 32)) return { ok: false, reason: "VAPID_PRIVATE_KEY_INVALID_FORMAT" };

  if (!subject) return { ok: false, reason: "VAPID_SUBJECT_MISSING" };
  if (/[\s\u0000-\u001f\u007f]/.test(subject)) return { ok: false, reason: "VAPID_SUBJECT_INVALID_WHITESPACE" };
  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/.test(subject)) {
    return { ok: false, reason: "VAPID_SUBJECT_INVALID_FORMAT" };
  }
  if (isPlaceholderSubject(subject)) return { ok: false, reason: "VAPID_SUBJECT_PLACEHOLDER" };

  return { ok: true, config: { publicKey, privateKey, subject } };
}
