import { computeQualificationScore, type QualificationBand } from "@/lib/qualification-score";
import type { LeadEngagement } from "@/lib/conversations";
import type { FollowUpRow } from "@/lib/supabase/types";

const BAND_CLASSES: Record<QualificationBand, string> = {
  Low: "text-surface-foreground-muted",
  Medium: "text-warning",
  High: "text-success",
  "Very High": "text-success",
};

// Hex counterpart of BAND_CLASSES -- the ring's stroke is an SVG attribute,
// not a Tailwind class, so it needs a real color value. Same band→color
// mapping, just in the form <circle stroke> needs; keep in sync.
const BAND_RING_COLORS: Record<QualificationBand, string> = {
  Low: "#A3A3A3",
  Medium: "#F59E0B",
  High: "#16A34A",
  "Very High": "#16A34A",
};

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score, band }: { score: number; band: QualificationBand }) {
  const offset = RING_CIRCUMFERENCE * (1 - score / 100);
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" className="shrink-0">
      <circle cx="38" cy="38" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
      <circle
        cx="38"
        cy="38"
        r={RING_RADIUS}
        fill="none"
        stroke={BAND_RING_COLORS[band]}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform="rotate(-90 38 38)"
      />
      <text x="38" y="34" textAnchor="middle" fontSize="18" fontWeight="600" fill="#FFFFFF">
        {score}
      </text>
      <text x="38" y="48" textAnchor="middle" fontSize="10" fill="#A3A3A3">
        / 100
      </text>
    </svg>
  );
}

// Auto-computed, deterministic -- see lib/qualification-score.ts. Renders
// as a plain content block (no Card wrapper) because it's one half of the
// single "Qualification" section on the Lead Detail page -- the other half
// is the staff's manual score/notes (QualificationForm). Two separate Cards
// here would make "Qualification" have two owners on the page; this and
// QualificationForm are composed together into ONE Card by the caller.
export function QualificationScoreSummary({
  lead,
  followUps,
  engagement,
}: {
  lead: Parameters<typeof computeQualificationScore>[0];
  followUps: Pick<FollowUpRow, "status">[];
  engagement: LeadEngagement;
}) {
  const result = computeQualificationScore(lead, followUps, engagement);
  const bandClass = BAND_CLASSES[result.band];

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-surface-foreground-muted">Auto-computed</p>
      <div className="mt-2 flex items-center gap-4">
        <ScoreRing score={result.score} band={result.band} />
        <div>
          <span className={`text-sm font-medium ${bandClass}`}>{result.band}</span>
          <p className="mt-0.5 text-sm text-surface-foreground-muted">{result.summary}</p>
        </div>
      </div>

      <details className="group mt-3">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-surface-foreground-muted marker:hidden hover:text-surface-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          View factors
        </summary>
        <ul className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
          {result.factors.map((factor) => (
            <li key={factor.label} className="flex items-center justify-between gap-3 text-xs">
              <span className={factor.met ? "text-surface-foreground" : "text-surface-foreground-muted"}>{factor.label}</span>
              <span className="shrink-0 tabular-nums text-surface-foreground-muted">
                {factor.points}/{factor.maxPoints}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
