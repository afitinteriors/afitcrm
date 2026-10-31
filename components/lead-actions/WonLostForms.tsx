"use client";

import { useActionState } from "react";
import { markLeadLost, markLeadWon } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";
import { LOST_REASON_CATEGORIES, LOST_REASON_CATEGORY_LABELS } from "@/lib/constants";
import type { LostReasonCategory } from "@/lib/supabase/types";

// R-WON-001 (docs/BLUEPRINT_V1.md Section 8): "No advance -> cannot mark
// Won." advanceProofReference is a required free-text field (UTR/
// transaction id/note) -- the server action (markLeadWon) is the real
// enforcement; this is just the matching required input.
export function MarkWonForm({
  leadId,
  jobValue,
  advanceProofReference,
}: {
  leadId: string;
  jobValue: number | null;
  advanceProofReference: string | null;
}) {
  const [state, formAction] = useActionState(markLeadWon, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="won_job_value" className="block text-xs font-medium text-surface-foreground-muted">
          Job value (₹)
        </label>
        <input
          id="won_job_value"
          name="job_value"
          type="number"
          min="1"
          step="1"
          required
          defaultValue={jobValue ?? ""}
          className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label htmlFor="advance_proof_reference" className="block text-xs font-medium text-surface-foreground-muted">
          Advance payment proof
        </label>
        <input
          id="advance_proof_reference"
          name="advance_proof_reference"
          type="text"
          required
          placeholder="UTR / transaction ID / note"
          defaultValue={advanceProofReference ?? ""}
          className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md bg-success px-3 text-xs font-medium text-success-foreground hover:bg-success/90 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Mark as Won
      </SubmitButton>
    </form>
  );
}

// R-LOST-001 (docs/BLUEPRINT_V1.md Section 8): a reason category is
// required (one of the 6 fixed Blueprint reasons); the free-text field is
// now an optional supplementary note, not the required field it used to
// be. The minimum-3-logged-calls check is server-side only (lib/actions/
// leads.ts) -- this form doesn't pre-count calls or disable the button,
// since the server error message already tells the staff member exactly
// how many more calls are needed, and duplicating that count here would
// just be a second place for it to drift out of sync.
export function MarkLostForm({ leadId, lostReason, lostReasonCategory }: { leadId: string; lostReason: string | null; lostReasonCategory: LostReasonCategory | null }) {
  const [state, formAction] = useActionState(markLeadLost, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="lost_reason_category" className="block text-xs font-medium text-surface-foreground-muted">
          Lost reason
        </label>
        <select
          id="lost_reason_category"
          name="lost_reason_category"
          required
          defaultValue={lostReasonCategory ?? ""}
          className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="" disabled>
            Select a reason
          </option>
          {LOST_REASON_CATEGORIES.map((reason) => (
            <option key={reason} value={reason}>
              {LOST_REASON_CATEGORY_LABELS[reason]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="lost_reason" className="block text-xs font-medium text-surface-foreground-muted">
          Additional notes (optional)
        </label>
        <textarea
          id="lost_reason"
          name="lost_reason"
          defaultValue={lostReason ?? ""}
          rows={2}
          className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md border border-danger px-3 text-xs font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Mark as Lost
      </SubmitButton>
    </form>
  );
}
