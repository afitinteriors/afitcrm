import type { LeadStatus } from "@/lib/supabase/types";

// Phase 3 (CLAUDE.md §5): which Lead Detail sections are relevant for a
// lead's CURRENT stage. Reuses every section already built -- this decides
// what renders, not how it renders. Header, Next Action, Overview,
// Follow-ups, Conversation, Assigned-to, and admin Activity are not listed
// here because they're relevant at every stage and always render.
export type SectionKey = "qualification" | "siteVisit" | "quotation" | "commercial";

// Won requires a commercial number to exist first, so it's only offered
// once a lead has reached Quotation/Negotiation -- winning a brand-new
// lead makes no business sense. Lost has no such constraint: a lead can
// go cold/disqualified (spam, wrong number, not interested) at any open
// stage, so it stays reachable throughout. Confirmed with the project
// owner rather than assumed.
export const WON_REACHABLE_FROM: LeadStatus[] = ["quotation", "negotiation"];

const STAGE_SECTIONS: Record<LeadStatus, SectionKey[]> = {
  new: ["qualification"],
  contacted: ["qualification"],
  qualified: ["qualification"],
  site_visit: ["qualification", "siteVisit"],
  quotation: ["qualification", "siteVisit", "quotation", "commercial"],
  negotiation: ["qualification", "siteVisit", "quotation", "commercial"],
  // Closed -- no more qualifying or quoting to do; commercial stays as the
  // record of what was won/quoted.
  won: ["commercial"],
  lost: ["commercial"],
  // Not a pipeline stage (a data-quality disposition, see StatusSelect) --
  // minimal, safe rendering rather than a full pipeline workspace.
  invalid: [],
};

export function getStageSections(status: LeadStatus): Set<SectionKey> {
  return new Set(STAGE_SECTIONS[status]);
}

export function canMarkWon(status: LeadStatus): boolean {
  return WON_REACHABLE_FROM.includes(status);
}
