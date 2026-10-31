// R-MSG-002 (docs/BLUEPRINT_V1.md Section 8): "Opt-out stops all follow-up
// and marketing messages... Customer writes stop." Exact (trimmed,
// case-insensitive) match only -- a substring match would false-positive on
// a real sentence like "please don't stop the work", which would
// incorrectly cut off a customer who never asked to opt out.
const OPT_OUT_BODIES = new Set(["stop"]);

export function isOptOutMessage(body: string | null | undefined): boolean {
  if (!body) return false;
  return OPT_OUT_BODIES.has(body.trim().toLowerCase());
}
