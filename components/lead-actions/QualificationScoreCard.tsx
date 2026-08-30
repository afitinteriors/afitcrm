import { computeQualificationScore, type QualificationBand } from "@/lib/qualification-score";
import type { LeadEngagement } from "@/lib/conversations";
import type { FollowUpRow } from "@/lib/supabase/types";

const BAND_CLASSES: Record<QualificationBand, string> = {
  Low: "text-muted-foreground",
  Medium: "text-warning",
  High: "text-success",
  "Very High": "text-success",
};

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
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Auto-computed</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-2xl font-semibold tabular-nums ${bandClass}`}>{result.score}</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
        <span className={`ml-1 text-sm font-medium ${bandClass}`}>{result.band}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>

      <details className="group mt-3">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground marker:hidden hover:text-foreground">
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
        <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
          {result.factors.map((factor) => (
            <li key={factor.label} className="flex items-center justify-between gap-3 text-xs">
              <span className={factor.met ? "text-foreground" : "text-muted-foreground"}>{factor.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {factor.points}/{factor.maxPoints}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
