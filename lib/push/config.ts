import "server-only";

// VAPID configuration for server-side Web Push. Everything here reads the
// server environment only; the private key never leaves this module except
// inside the returned object handed straight to web-push, and no error or
// log message built here ever contains it.

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export type VapidConfigResult =
  | { ok: true; config: VapidConfig }
  | { ok: false; reason: "missing" | "invalid_subject" | "placeholder_subject" };

// The subject is the contact address push services can use to reach the
// operator. It must be a real mailto: or https: URL -- the placeholder that
// was set while bootstrapping (an @afit.example address) must be replaced
// before any real push is sent.
function isPlaceholderSubject(subject: string): boolean {
  return /@([a-z0-9-]+\.)*example(\.[a-z]+)?$/i.test(subject) || /^https?:\/\/([a-z0-9-]+\.)*example(\.[a-z]+)?(\/|$)/i.test(subject);
}

export function getVapidConfig(env: NodeJS.ProcessEnv = process.env): VapidConfigResult {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return { ok: false, reason: "missing" };

  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/.test(subject)) return { ok: false, reason: "invalid_subject" };
  if (isPlaceholderSubject(subject)) return { ok: false, reason: "placeholder_subject" };

  return { ok: true, config: { publicKey, privateKey, subject } };
}
