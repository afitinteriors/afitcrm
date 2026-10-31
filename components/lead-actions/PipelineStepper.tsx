import { OPEN_LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";
import type { LeadStatus } from "@/lib/supabase/types";

// Presentational only (Blueprint V1 Decisions, CLAUDE.md "Lead/Pipeline
// Architecture", 2026-10-31) -- this never writes `leads.status` itself.
// StatusSelect (in the left sidebar) remains the one control that actually
// moves a lead between stages; this just shows where the lead currently
// sits in the funnel. "invalid" is a data-quality disposition, not a
// pipeline stage (see lib/constants.ts), so it renders nothing here.
export function PipelineStepper({ status }: { status: LeadStatus }) {
  if (status === "invalid") return null;

  const steps = OPEN_LEAD_STATUSES;
  const currentIndex = status === "won" || status === "lost" ? steps.length : steps.indexOf(status);

  return (
    <div
      role="list"
      aria-label="Pipeline progress"
      className="mt-3 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-glass p-4 backdrop-blur-sm sm:gap-2"
    >
      {steps.map((step, i) => (
        <StepNode
          key={step}
          label={LEAD_STATUS_LABELS[step]}
          index={i + 1}
          state={i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming"}
          connectorBefore={i > 0}
          connectorDone={i <= currentIndex}
        />
      ))}
      <FinalNode status={status} connectorDone={currentIndex >= steps.length} />
    </div>
  );
}

function StepNode({
  label,
  index,
  state,
  connectorBefore,
  connectorDone,
}: {
  label: string;
  index: number;
  state: "done" | "current" | "upcoming";
  connectorBefore: boolean;
  connectorDone: boolean;
}) {
  return (
    <div role="listitem" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      {connectorBefore && <Connector done={connectorDone} />}
      <div className="flex items-center gap-2">
        <div
          className={
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
            (state === "done"
              ? "bg-success text-success-foreground"
              : state === "current"
                ? "bg-gold text-gold-foreground"
                : "border border-white/15 text-surface-foreground-muted")
          }
        >
          {state === "done" ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          ) : (
            index
          )}
        </div>
        <span
          className={
            "whitespace-nowrap text-xs " +
            (state === "current" ? "font-semibold text-surface-foreground" : "text-surface-foreground-muted")
          }
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function FinalNode({ status, connectorDone }: { status: LeadStatus; connectorDone: boolean }) {
  const isWon = status === "won";
  const isLost = status === "lost";

  return (
    <div role="listitem" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Connector done={connectorDone} />
      <div className="flex items-center gap-2">
        <div
          className={
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
            (isWon
              ? "bg-success text-success-foreground"
              : isLost
                ? "bg-danger text-danger-foreground"
                : "border border-white/15 text-surface-foreground-muted")
          }
        >
          {isWon ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          ) : isLost ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            "–"
          )}
        </div>
        <span
          className={
            "whitespace-nowrap text-xs " +
            (isWon ? "font-semibold text-success" : isLost ? "font-semibold text-danger" : "text-surface-foreground-muted")
          }
        >
          {isWon ? "Won" : isLost ? "Lost" : "Won / lost"}
        </span>
      </div>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return <div aria-hidden="true" className={"h-px w-4 shrink-0 sm:w-6 " + (done ? "bg-success" : "bg-white/15")} />;
}
