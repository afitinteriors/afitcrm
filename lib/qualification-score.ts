import type { FollowUpRow, LeadRow } from "@/lib/supabase/types";
import type { LeadEngagement } from "@/lib/conversations";

// Deterministic, explainable auto qualification score -- a pure function of
// data that already exists on the lead/follow_ups/messages tables. No AI/LLM,
// no external calls, no stored/cached value: recomputed on every render from
// the same inputs, so it can never drift out of sync and always produces the
// same score for the same data.
//
// This is intentionally separate from leads.qualification_score (the existing
// manually-typed-in field on the "Qualification" card). That one is a human's
// subjective opinion; this one is a mechanical read of what's actually on
// file. Conflating them would make this score non-deterministic (an admin
// could type any number), which the spec for this feature explicitly rules
// out. Pipeline stage (leads.status) is deliberately NOT an input either, so
// the score stays a genuinely independent signal rather than a restatement
// of the stage the lead already visibly sits in.

export type QualificationBand = "Low" | "Medium" | "High" | "Very High";

export type QualificationFactor = {
  label: string;
  points: number;
  maxPoints: number;
  met: boolean;
};

export type QualificationResult = {
  score: number;
  band: QualificationBand;
  summary: string;
  factors: QualificationFactor[];
};

function bandFor(score: number): QualificationBand {
  if (score >= 85) return "Very High";
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

type ScoredLead = Pick<
  LeadRow,
  | "customer_name"
  | "location"
  | "project_type"
  | "service_required"
  | "expected_start_date"
  | "estimated_sqft"
  | "whatsapp_message"
  | "quotation_amount"
  | "site_visit_date"
>;

export function computeQualificationScore(
  lead: ScoredLead,
  followUps: Pick<FollowUpRow, "status">[],
  engagement: LeadEngagement,
): QualificationResult {
  const factors: QualificationFactor[] = [];
  const add = (label: string, met: boolean, maxPoints: number) => {
    factors.push({ label, points: met ? maxPoints : 0, maxPoints, met });
  };

  // Lead/contact completeness + requirement clarity -- 5 pts each, 25 total.
  add("Customer name on file", hasText(lead.customer_name), 5);
  add("Location recorded", hasText(lead.location), 5);
  add("Project type specified", hasText(lead.project_type), 5);
  add("Service required specified", hasText(lead.service_required), 5);
  add("Expected start date set", hasText(lead.expected_start_date), 5);

  // Estimated project size -- the only "scope/value" signal available before
  // a quotation exists. 10 pts.
  add("Estimated project size recorded", lead.estimated_sqft !== null && lead.estimated_sqft !== undefined, 10);

  // Original inquiry captured -- 5 pts.
  add("Original inquiry message captured", hasText(lead.whatsapp_message), 5);

  // Quotation status -- 15 pts. (job_value deliberately excluded: it's only
  // ever set via Mark as Won, so using it here would make the score leak
  // pipeline-stage information rather than staying an independent signal.)
  add("Quotation prepared", lead.quotation_amount !== null && lead.quotation_amount !== undefined, 15);

  // Site visit status -- 15 pts. No separate site-visit status field exists
  // yet (see the Site Visit architecture proposal), so this can only report
  // "scheduled or completed", not distinguish between the two.
  add("Site visit scheduled or completed", hasText(lead.site_visit_date), 15);

  // Follow-up activity -- 5 pts each, 15 total.
  const followUpCount = followUps.length;
  const completedFollowUps = followUps.filter((f) => f.status === "completed").length;
  add("At least one follow-up logged", followUpCount > 0, 5);
  add("At least one follow-up completed", completedFollowUps > 0, 5);
  add("Sustained follow-up activity (3+)", followUpCount >= 3, 5);

  // Conversation / message engagement -- 5 pts each, 15 total.
  add("WhatsApp conversation linked", engagement.hasConversation, 5);
  add("Multiple messages exchanged (3+)", engagement.messageCount >= 3, 5);
  add("Two-way conversation (customer replied)", engagement.hasInbound && engagement.hasOutbound, 5);

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const band = bandFor(score);

  const completeCount = factors.slice(0, 5).filter((f) => f.met).length;
  const highlights: string[] = [];
  if (engagement.hasInbound && engagement.hasOutbound) highlights.push("active WhatsApp engagement");
  else if (engagement.messageCount >= 3) highlights.push("WhatsApp engagement");
  if (completeCount >= 4) highlights.push("clear requirement");
  if (hasText(lead.site_visit_date)) highlights.push("site visit scheduled");
  if (lead.quotation_amount !== null && lead.quotation_amount !== undefined) highlights.push("quotation prepared");
  if (completedFollowUps > 0 || followUpCount >= 3) highlights.push("consistent follow-up");
  if (highlights.length === 0) highlights.push("limited information recorded so far");

  const summary =
    highlights.slice(0, 3).join(" + ").replace(/^./, (c) => c.toUpperCase());

  return { score, band, summary, factors };
}
