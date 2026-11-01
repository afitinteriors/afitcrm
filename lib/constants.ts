import type { CallOutcome, FollowUpType, LeadStatus, LostReasonCategory } from "@/lib/supabase/types";

// Every value the `leads.status` column can hold. Used for schema-level
// validation (e.g. isLeadStatus()) and internal bookkeeping -- NOT for
// rendering the sales pipeline. "invalid" is a disposition/data-quality
// marker (a lead that was never a real inquiry), not a stage a lead moves
// through, so user-facing pipeline UI must use PIPELINE_STATUSES instead.
export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "site_visit",
  "quotation",
  "negotiation",
  "won",
  "lost",
  "invalid",
];

export const OPEN_LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "site_visit",
  "quotation",
  "negotiation",
];

// The business pipeline: exactly these 8 stages, in funnel order. This is
// the list every user-facing pipeline surface must render from -- the Lead
// Detail stage selector, the Leads status filter, and the dashboard
// pipeline visualization -- instead of LEAD_STATUSES, so "invalid" (and any
// future non-pipeline disposition added to the schema) never shows up as a
// pipeline stage.
export const PIPELINE_STATUSES: LeadStatus[] = [...OPEN_LEAD_STATUSES, "won", "lost"];

// Won and Lost are terminal for the generic stage setter (setLeadStatus
// rejects any move out of them server-side). The UI mirrors that by not
// offering the stage selector for a closed lead.
export function isClosedLeadStatus(status: LeadStatus): boolean {
  return status === "won" || status === "lost";
}

// R-LOST-001 (docs/BLUEPRINT_V1.md Section 8): the only reasons a lead
// can be marked Lost under. Minimum-3-logged-calls is enforced in
// lib/actions/leads.ts's markLeadLost(), not here -- this list is just the
// fixed category set.
export const LOST_REASON_CATEGORIES: LostReasonCategory[] = [
  "price",
  "chose_another",
  "plan_cancelled",
  "no_response",
  "out_of_area",
  "other",
];

export const LOST_REASON_CATEGORY_LABELS: Record<LostReasonCategory, string> = {
  price: "Price",
  chose_another: "Chose another provider",
  plan_cancelled: "Plan cancelled",
  no_response: "No response",
  out_of_area: "Out of area",
  other: "Other",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  site_visit: "Site Visit",
  quotation: "Quotation",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  invalid: "Invalid",
};

export const LEAD_STATUS_BADGE_CLASSES: Record<LeadStatus, string> = {
  new: "bg-slate-100 text-slate-700 ring-slate-600/20",
  contacted: "bg-sky-100 text-sky-700 ring-sky-600/20",
  qualified: "bg-indigo-100 text-indigo-700 ring-indigo-600/20",
  site_visit: "bg-amber-100 text-amber-700 ring-amber-600/20",
  quotation: "bg-purple-100 text-purple-700 ring-purple-600/20",
  negotiation: "bg-orange-100 text-orange-700 ring-orange-600/20",
  won: "bg-emerald-100 text-emerald-700 ring-emerald-600/20",
  lost: "bg-red-100 text-red-700 ring-red-600/20",
  invalid: "bg-zinc-100 text-zinc-700 ring-zinc-600/20",
};

// Solid-fill counterpart of LEAD_STATUS_BADGE_CLASSES -- same hue per status,
// used where a pastel+ring badge doesn't apply (dashboard pipeline bar/legend
// dots). Kept alongside the badge classes so status color stays defined in
// exactly one place.
export const LEAD_STATUS_BAR_CLASSES: Record<LeadStatus, string> = {
  new: "bg-slate-400",
  contacted: "bg-sky-500",
  qualified: "bg-indigo-500",
  site_visit: "bg-amber-500",
  quotation: "bg-purple-500",
  negotiation: "bg-orange-500",
  won: "bg-emerald-500",
  lost: "bg-red-500",
  invalid: "bg-zinc-400",
};

// Hex equivalents of LEAD_STATUS_BAR_CLASSES' exact Tailwind shades, for
// contexts that need a real color value rather than a class (recharts fills/
// strokes) -- same one color-per-status definition, just in the form SVG
// chart libraries need. Keep in sync with LEAD_STATUS_BAR_CLASSES above.
export const LEAD_STATUS_CHART_COLORS: Record<LeadStatus, string> = {
  new: "#94a3b8",
  contacted: "#0ea5e9",
  qualified: "#6366f1",
  site_visit: "#f59e0b",
  quotation: "#a855f7",
  negotiation: "#f97316",
  won: "#10b981",
  lost: "#ef4444",
  invalid: "#a1a1aa",
};

export const LEAD_SOURCES = [
  "whatsapp",
  "meta_ads",
  "phone",
  "referral",
  "website",
  "walk_in",
  "manual",
  "other",
] as const;

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  meta_ads: "Meta Ads",
  phone: "Phone",
  referral: "Referral",
  website: "Website",
  walk_in: "Walk-in",
  manual: "Manual",
  other: "Other",
};

export const FOLLOW_UP_TYPES: FollowUpType[] = [
  "follow_up",
  "call",
  "whatsapp_message",
  "site_visit",
  "quotation",
  "meeting",
];

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  follow_up: "Follow-up",
  call: "Call",
  whatsapp_message: "WhatsApp message",
  site_visit: "Site visit",
  quotation: "Quotation",
  meeting: "Meeting",
};

// R-CALL-001 (docs/BLUEPRINT_V1.md Phase 3) -- the fixed 5-outcome set the
// mandatory call popup offers. Order matches the blueprint's own example.
export const CALL_OUTCOMES: CallOutcome[] = ["answered", "no_answer", "busy", "wrong_number", "not_interested"];

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  answered: "Answered",
  no_answer: "No answer",
  busy: "Busy",
  wrong_number: "Wrong number",
  not_interested: "Not interested",
};

// R-CALL-002: every outcome needs a next follow-up date except Wrong
// number.
export const CALL_OUTCOME_EXEMPT_FROM_FOLLOWUP: CallOutcome = "wrong_number";

// Safety cap for list/report queries that have no pagination yet
// (getLeads(), getFollowUps(), the Reports aggregation queries). Matches
// this project's own configured PostgREST max_rows (supabase/config.toml
// [api] max_rows = 1000) -- without an explicit .limit(), those queries
// were silently relying on that server-side default, so a result past row
// 1000 would already be truncated with no error and no indication
// anywhere in the app. This makes that boundary explicit and intentional
// instead of an invisible accident, but it is a stopgap, not a fix: real
// pagination (or, for Reports, moving aggregation into SQL) is needed
// before lead/follow-up volume actually approaches this number.
export const UNPAGINATED_LIST_QUERY_LIMIT = 1000;

// R-LOST-001 (docs/BLUEPRINT_V1.md Section 8): minimum resolved call_logs
// rows a lead must have before it can be marked Lost.
export const MIN_CALLS_BEFORE_LOST = 3;

// R-LEAD-003 (docs/BLUEPRINT_V1.md Section 8): "A new lead must get a first
// response within 15 minutes ... lead turns red ... staff at 15 min, owner
// at 30 min." Editable in Settings per the blueprint; hard-coded here as the
// default until a Settings page for rule timers exists (Blueprint V1
// Decisions, CLAUDE.md).
export const RESPONSE_ALERT_STAFF_MINUTES = 15;
export const RESPONSE_ALERT_OWNER_MINUTES = 30;

// Section 8: "Business hours default to 9:00 to 20:00 IST; timers pause
// outside them." Same Settings-later caveat as above.
export const BUSINESS_HOURS_START_HOUR = 9;
export const BUSINESS_HOURS_END_HOUR = 20;

// Blueprint V1 Section 7 (docs/BLUEPRINT_V1.md): "Win chances are starting
// values; adjust them once real conversion data exists." Same Settings-later
// caveat as the rule timers above -- hard-coded here as the default until a
// Settings page for pipeline configuration exists. The blueprint's own
// stage list (New/AI talking/Contacted/Qualified/Visit scheduled/Visit
// done/Quote sent/Negotiation/Won) doesn't match this app's actual 8-stage
// pipeline (PIPELINE_STATUSES) 1:1 -- no "AI talking" or separate
// scheduled/done split exists -- so values are mapped onto the stages that
// actually exist, keeping the blueprint's relative ordering and magnitudes.
export const STAGE_WIN_CHANCE: Record<LeadStatus, number> = {
  new: 0.05,
  contacted: 0.1,
  qualified: 0.2,
  site_visit: 0.35,
  quotation: 0.6,
  negotiation: 0.75,
  won: 1,
  lost: 0,
  invalid: 0,
};

// Blueprint V1 Section 9 (docs/BLUEPRINT_V1.md): Hermes's "System health"
// job ("Webhook silent too long ... every 15 minutes"). The blueprint gives
// no exact number for "too long" (unlike R-LEAD-003/R-STAGE-002's explicit
// minutes/days) -- this implementation's own reasonable default, not a
// number from the blueprint. Same Settings-later caveat as the other rule
// constants above.
export const WEBHOOK_SILENCE_ALERT_MINUTES = 120;

// R-QUOTE-002 (docs/BLUEPRINT_V1.md Section 8): "Discount above the
// owner's limit needs owner approval ... Limit 5%, Azhar enters 8% ->
// approval request." Same Settings-later caveat as above. Measured against
// a quotation's own version 1 -- see lib/actions/quotations.ts.
export const DISCOUNT_APPROVAL_LIMIT_PERCENT = 5;
