"use client";

import { useState, useTransition } from "react";
import { setLeadStatus } from "@/lib/actions/leads";
import { PIPELINE_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASSES } from "@/lib/constants";
import type { LeadStatus } from "@/lib/supabase/types";

function isPipelineStatus(s: LeadStatus): boolean {
  return (PIPELINE_STATUSES as LeadStatus[]).includes(s);
}

// The single authoritative status control for a lead -- styled as the
// status badge itself (colored pill matching LEAD_STATUS_BADGE_CLASSES, the
// same palette Dashboard/Leads use) rather than a separate grey form field
// next to a separate read-only badge.
//
// Only the 8 PIPELINE_STATUSES are ever listed as options -- "invalid" is a
// data-quality disposition, not a stage a lead moves through, and must
// never appear in this selector (see the early return below for how a lead
// that's currently "invalid" is displayed instead).
//
// "won" and "lost" ARE listed (the selector shows the full pipeline), but
// picking either does NOT call setLeadStatus() directly -- that would
// silently skip markLeadWon's job_value capture and, worse, markLeadLost's
// *required* lost_reason. That was a real, previously-reachable path to a
// "lost" lead with no reason recorded at all. Instead, picking either one
// reverts the visible selection and opens/scrolls to the Close Lead section
// (#close-lead) below, which captures that context properly. The server
// action rejects these transitions too (see setLeadStatus in
// lib/actions/leads.ts) -- this client redirect is a courtesy, not the
// enforcement.
export function StatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // A lead can only reach a non-pipeline status (currently just "invalid")
  // through direct data edits, not through this selector. When that's the
  // current value, show it as a plain disposition badge instead of
  // pretending it's a pipeline stage -- with an explicit, opt-in way to
  // move it into the pipeline, rather than silently defaulting the select
  // to whichever stage happens to be listed first.
  const [reclassifying, setReclassifying] = useState(false);

  if (!isPipelineStatus(value) && !reclassifying) {
    return (
      <div className="inline-flex items-center gap-2">
        <span
          className={`inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset ${LEAD_STATUS_BADGE_CLASSES[value]}`}
        >
          {LEAD_STATUS_LABELS[value]}
        </span>
        <button
          type="button"
          onClick={() => setReclassifying(true)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Move to pipeline stage
        </button>
      </div>
    );
  }

  const selectValue = isPipelineStatus(value) ? value : "";

  return (
    <div>
      <label htmlFor="status-select" className="sr-only">
        Pipeline stage
      </label>
      <div className="relative inline-block">
        <select
          id="status-select"
          value={selectValue}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as LeadStatus;
            if (!next) return;

            if (next === "won" || next === "lost") {
              // Not a real status change -- revert the DOM selection (no
              // state update happens, so React won't do this on its own)
              // and send the user to the form that actually captures the
              // required data for that transition.
              e.currentTarget.value = selectValue;
              const section = document.getElementById("close-lead");
              if (section instanceof HTMLDetailsElement) {
                section.open = true;
                section.scrollIntoView({ behavior: "smooth", block: "start" });
              }
              return;
            }

            const previous = value;
            setValue(next);
            setError(null);
            startTransition(async () => {
              const result = await setLeadStatus(leadId, next);
              if (result?.error) {
                setError(result.error);
                setValue(previous);
              }
            });
          }}
          className={`h-11 appearance-none rounded-full py-0 pl-4 pr-9 text-sm font-semibold ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 ${
            selectValue ? LEAD_STATUS_BADGE_CLASSES[selectValue] : "bg-muted text-muted-foreground ring-border"
          }`}
        >
          {!selectValue && (
            <option value="" disabled>
              Choose a stage…
            </option>
          )}
          {PIPELINE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
