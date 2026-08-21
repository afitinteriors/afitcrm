import type { LeadStatus } from "@/lib/supabase/types";

// Order mirrors the pipeline. WON/LOST/INVALID are terminal states.
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
