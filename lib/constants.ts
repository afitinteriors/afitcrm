import type { FollowUpType, LeadStatus } from "@/lib/supabase/types";

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
