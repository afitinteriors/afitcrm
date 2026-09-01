// Pure text helpers for keyword matching -- no I/O, easily testable in
// isolation. Deliberately separate from lib/automation/ (singular), the
// existing client-only visual-builder prototype -- this is the real,
// server-side matching engine.

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,!?;:()"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-boundary phrase containment, not a raw substring check -- stops "ac"
// matching inside "back" or "mac". The keyword may be multiple words; it
// must appear as a contiguous, whitespace-delimited run inside the message.
export function containsKeyword(normalizedMessage: string, normalizedKeyword: string): boolean {
  if (!normalizedKeyword) return false;
  const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\s)${escaped}(\\s|$)`);
  return pattern.test(normalizedMessage);
}
