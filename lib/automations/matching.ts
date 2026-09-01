import { normalizeText, containsKeyword } from "./text";

export type ActiveKeyword = {
  id: string;
  service_id: string;
  keyword: string;
  priority: number;
};

export type MatchResult =
  | { outcome: "no_match" }
  | { outcome: "ambiguous"; keyword: string; serviceIds: string[] }
  | { outcome: "matched"; keyword: string; serviceId: string };

// Deterministic priority resolution (approved architecture, rule 3): group
// every matching keyword by its priority number, then look ONLY at the
// lowest-numbered tier that has any match at all -- lower-priority tiers
// are never even consulted once a higher tier has a hit, regardless of what
// they contain. Within the winning tier, keywords belonging to the SAME
// service are fine (they all point at the same automation anyway); if the
// winning tier spans more than one DISTINCT service, that's a genuine,
// unresolved ambiguity -- reported, never silently picked.
export function matchKeyword(activeKeywords: ActiveKeyword[], messageBody: string | null): MatchResult {
  if (!messageBody) return { outcome: "no_match" };
  const normalizedMessage = normalizeText(messageBody);
  if (!normalizedMessage) return { outcome: "no_match" };

  const byPriority = new Map<number, ActiveKeyword[]>();
  for (const kw of activeKeywords) {
    if (!containsKeyword(normalizedMessage, normalizeText(kw.keyword))) continue;
    const bucket = byPriority.get(kw.priority) ?? [];
    bucket.push(kw);
    byPriority.set(kw.priority, bucket);
  }

  if (byPriority.size === 0) return { outcome: "no_match" };

  const topPriority = Math.min(...byPriority.keys());
  const winners = byPriority.get(topPriority)!;
  const distinctServiceIds = Array.from(new Set(winners.map((w) => w.service_id)));

  if (distinctServiceIds.length > 1) {
    return { outcome: "ambiguous", keyword: winners[0].keyword, serviceIds: distinctServiceIds };
  }

  return { outcome: "matched", keyword: winners[0].keyword, serviceId: distinctServiceIds[0] };
}
