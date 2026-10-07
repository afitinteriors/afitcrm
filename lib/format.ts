import { BUSINESS_TZ } from "@/lib/business-time";

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

// "₹12.8 Lakhs" for the Pipeline Value card -- Indian currency shorthand,
// distinct from formatCurrency's full ₹ figure used elsewhere.
export function formatLakhs(value: number): string {
  const lakhs = value / 100000;
  const formatted = lakhs >= 100 ? lakhs.toFixed(0) : lakhs.toFixed(1);
  return `₹${formatted} Lakhs`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: BUSINESS_TZ,
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TZ,
  }).format(new Date(value));
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });

  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minutes"],
    [24, "hours"],
    [30, "days"],
    [12, "months"],
    [Number.POSITIVE_INFINITY, "years"],
  ];

  let duration = diffMinutes;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return formatter.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return formatter.format(Math.round(duration), "years");
}

function normalizeIndianPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  // A manually-typed number sometimes keeps the domestic trunk prefix "0"
  // (e.g. "09633603670") -- left in place, that becomes part of the
  // country code below and produces a WhatsApp link to the wrong number.
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function telLink(phone: string): string {
  return `tel:+${normalizeIndianPhone(phone)}`;
}

export function whatsappLink(phone: string): string {
  return `https://wa.me/${normalizeIndianPhone(phone)}`;
}

// For an avatar-initial circle. Deliberately NOT `name.charAt(0)`: that
// reads the first UTF-16 *code unit*, not the first character -- for any
// name starting with an emoji or other supplementary-plane character
// (common in real WhatsApp contact names, e.g. "🙏🙏", "𝓥𝓲𝓷𝓸𝓭..."), that's
// only half of a surrogate pair. A lone surrogate can't be represented in
// UTF-8, so a server-rendered page encodes it as U+FFFD while a client
// re-render of the same expression reconstructs the original lone
// surrogate from the untouched string prop -- two different values, a
// React hydration error (#418) on every page load that lists such a name.
// Array.from() iterates by Unicode code point, so it always grabs the
// complete first character on both sides.
export function firstInitial(name: string): string {
  const first = Array.from(name)[0] ?? "";
  return first.toUpperCase();
}

export function labelize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
