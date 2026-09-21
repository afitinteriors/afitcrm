// The single business time zone for AFIT CRM. Everything that means "a wall
// clock time typed by staff" or "which calendar day is it" goes through this
// module, so it never depends on the server's zone (UTC on Vercel) or the
// viewer's browser zone. Pure Intl -- no dependency, safe in client components.

export const BUSINESS_TZ = "Asia/Kolkata";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsOf(date: Date): Parts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as Parts;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

// The zone's UTC offset (ms) at a given instant, derived from Intl rather than
// hard-coded, so this stays correct if BUSINESS_TZ ever observes DST.
function offsetMs(date: Date): number {
  const p = partsOf(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// "YYYY-MM-DD" calendar day, in the business zone, of an instant (default: now).
export function businessDate(date: Date = new Date()): string {
  const p = partsOf(date);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

// Business-zone calendar day of a stored timestamp string (ISO / timestamptz).
export function businessDateOf(timestamp: string): string | null {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? null : businessDate(d);
}

// The business-zone calendar day `days` after today (or after `from`), as
// "YYYY-MM-DD". Pure calendar arithmetic on the business-day string, so the
// result never depends on the server's zone or on DST.
export function businessDatePlusDays(days: number, from: Date = new Date()): string {
  const [y, m, d] = businessDate(from).split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// Parses a <input type="datetime-local"> value ("2026-10-05T11:00") as WALL
// CLOCK TIME IN THE BUSINESS ZONE and returns the absolute instant. Returns
// null for anything that isn't a real date-time.
export function parseBusinessDateTime(local: string): Date | null {
  const m = LOCAL_PATTERN.exec(local.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wallAsUtc);
  // Reject overflow like 2026-02-31 or 25:00.
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null;
  }

  // Two passes settle the offset even across a DST transition.
  let instant = wallAsUtc - offsetMs(new Date(wallAsUtc));
  instant = wallAsUtc - offsetMs(new Date(instant));
  return new Date(instant);
}

// Inverse of parseBusinessDateTime, for prefilling a datetime-local input:
// "2026-10-05T11:00" in the business zone. Empty string for null/invalid.
export function toBusinessDateTimeLocal(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  const p = partsOf(d);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
