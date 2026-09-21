import Link from "next/link";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { telLink, whatsappLink } from "@/lib/format";
import type { LeadStatus } from "@/lib/supabase/types";

// Shared lead-card visual system, extracted from the Today card so /today and
// /leads render the same product. Presentation only: class strings are
// unchanged from the original TodayItemRow.

// Left accent + hover border follow the lead's stage (New blue, Quotation
// purple, Lost red, ...), so the colour carries meaning. Class strings are
// written out in full so Tailwind can see them.
export const STAGE_ACCENT: Record<LeadStatus, { bar: string; hover: string }> = {
  new: { bar: "border-l-blue-500", hover: "hover:border-y-blue-300 hover:border-r-blue-300" },
  contacted: { bar: "border-l-sky-400", hover: "hover:border-y-sky-300 hover:border-r-sky-300" },
  qualified: { bar: "border-l-teal-400", hover: "hover:border-y-teal-300 hover:border-r-teal-300" },
  site_visit: { bar: "border-l-amber-400", hover: "hover:border-y-amber-300 hover:border-r-amber-300" },
  quotation: { bar: "border-l-purple-500", hover: "hover:border-y-purple-300 hover:border-r-purple-300" },
  negotiation: { bar: "border-l-orange-400", hover: "hover:border-y-orange-300 hover:border-r-orange-300" },
  won: { bar: "border-l-emerald-500", hover: "hover:border-y-emerald-300 hover:border-r-emerald-300" },
  lost: { bar: "border-l-red-500", hover: "hover:border-y-red-300 hover:border-r-red-300" },
  invalid: { bar: "border-l-slate-300", hover: "hover:border-y-slate-300 hover:border-r-slate-300" },
};

// The avatar's pastel is derived from the lead id, so a given lead always
// keeps the same colour (never random per render).
const AVATARS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-800",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-800",
] as const;

export function avatarFor(leadId: string) {
  let hash = 0;
  for (const ch of leadId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

// Initials come only from the customer's name. lib/today.ts substitutes this
// placeholder when a lead has no name; showing "UL" for it would be
// misleading, so those rows get a neutral person glyph instead.
export const UNNAMED = "Unnamed lead";

export function initialsFor(name: string): string | null {
  if (name === UNNAMED) return null;
  const firstLetters = name
    .split(/\s+/)
    .map((word) => word.match(/\p{L}/u)?.[0])
    .filter((letter): letter is string => Boolean(letter));
  if (firstLetters.length >= 2) return (firstLetters[0] + firstLetters[1]).toUpperCase();
  const letters = name.match(/\p{L}/gu) ?? [];
  return letters.length > 0 ? letters.slice(0, 2).join("").toUpperCase() : null;
}

// Soft tinted stage pill (this replaces the shared StatusBadge only inside
// the Today card, so the rest of the app is untouched).
const STAGE_BADGE: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700 ring-blue-200",
  contacted: "bg-sky-50 text-sky-700 ring-sky-200",
  qualified: "bg-violet-50 text-violet-700 ring-violet-200",
  site_visit: "bg-amber-50 text-amber-800 ring-amber-200",
  quotation: "bg-purple-50 text-purple-700 ring-purple-200",
  negotiation: "bg-orange-50 text-orange-700 ring-orange-200",
  won: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  lost: "bg-red-50 text-red-700 ring-red-200",
  invalid: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StageBadge({ stage }: { stage: LeadStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STAGE_BADGE[stage]}`}>
      {LEAD_STATUS_LABELS[stage]}
    </span>
  );
}

export const ICON = {
  clock: "M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z",
  chat: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
  pin: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  doc: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z",
  tag: "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z",
  user: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0",
  phone:
    "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
} as const;

export function Glyph({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

// Icon-only contact actions: soft blue for Call, soft green for WhatsApp.
// The label lives in aria-label/title and the two glyphs have clearly
// different shapes, so the action never depends on colour alone. 44px touch
// targets on mobile, compact 36px on desktop.
const ICON_BUTTON =
  "inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9 lg:w-9";
export const CALL_BUTTON = `${ICON_BUTTON} bg-blue-100 text-blue-700 ring-blue-200 hover:bg-blue-200 lg:bg-blue-50 lg:text-blue-600 lg:ring-blue-100 lg:hover:bg-blue-100`;
export const WHATSAPP_BUTTON = `${ICON_BUTTON} bg-emerald-100 text-emerald-700 ring-emerald-200 hover:bg-emerald-200 lg:bg-emerald-50 lg:text-emerald-600 lg:ring-emerald-100 lg:hover:bg-emerald-100`;

function PhoneIcon() {
  return <Glyph d={ICON.phone} className="h-[18px] w-[18px]" />;
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ---- Shared card pieces -----------------------------------------------------
// Each lead is one rounded card. The customer name is the stretched link to
// Lead Detail (its ::after covers the card); the contact icons sit above that
// overlay (relative z-10) so Call / WhatsApp never open Lead Detail.

export function leadCardClass(stage: LeadStatus): string {
  const accent = STAGE_ACCENT[stage];
  return `group relative mx-2 my-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-2xl border border-l-4 border-border bg-card p-3.5 shadow-sm lg:p-3 transition-all duration-150 hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:mx-3 lg:my-2 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] ${accent.bar} ${accent.hover}`;
}

export function LeadAvatar({ leadId, name }: { leadId: string; name: string }) {
  const initials = initialsFor(name);
  return (
    <span
      className={`[grid-area:1/1/2/2] flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold lg:h-10 lg:w-10 lg:[grid-area:1/1/4/2] ${avatarFor(leadId)}`}
      aria-hidden="true"
    >
      {initials ?? <Glyph d={ICON.user} className="h-5 w-5" />}
    </span>
  );
}

export function LeadNameLink({ leadId, name }: { leadId: string; name: string }) {
  return (
    <Link
      href={`/leads/${leadId}`}
      className="min-w-0 max-w-full break-words text-base font-semibold leading-snug text-foreground after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
    >
      {name}
    </Link>
  );
}

export function LeadContactActions({ phone }: { phone: string | null }) {
  return (
    <div className="relative z-10 flex items-center gap-2 self-end [grid-area:3/3/4/4] lg:gap-2 lg:self-center lg:[grid-area:1/3/4/4]">
      {phone && (
        <a href={telLink(phone)} aria-label="Call customer" title="Call customer" className={CALL_BUTTON}>
          <PhoneIcon />
        </a>
      )}
      {phone && (
        <a
          href={whatsappLink(phone)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp customer"
          title="WhatsApp customer"
          className={WHATSAPP_BUTTON}
        >
          <WhatsAppIcon />
        </a>
      )}
    </div>
  );
}

export function LeadChevron() {
  return (
    <span
      className="pointer-events-none flex h-6 w-6 items-center justify-center justify-self-end text-muted-foreground/70 transition-all [grid-area:1/3/2/4] group-hover:translate-x-0.5 group-hover:text-foreground lg:h-8 lg:w-8 lg:justify-self-auto lg:rounded-full lg:bg-muted/60 lg:text-muted-foreground lg:[grid-area:1/4/4/5] lg:group-hover:bg-muted"
      aria-hidden="true"
    >
      <ChevronIcon />
    </span>
  );
}
