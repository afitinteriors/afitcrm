"use client";

import { useActionState } from "react";
import { setLeadQualification } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";

export function QualificationForm({
  leadId,
  score,
  notes,
}: {
  leadId: string;
  score: number | null;
  notes: string | null;
}) {
  const [state, formAction] = useActionState(setLeadQualification, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="qualification_score" className="block text-xs font-medium text-muted-foreground">
          Score (0–100)
        </label>
        <input
          id="qualification_score"
          name="qualification_score"
          type="number"
          min="0"
          max="100"
          defaultValue={score ?? ""}
          className="mt-1 block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label htmlFor="qualification_notes" className="block text-xs font-medium text-muted-foreground">
          Notes
        </label>
        <textarea
          id="qualification_notes"
          name="qualification_notes"
          defaultValue={notes ?? ""}
          rows={3}
          className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Save qualification
      </SubmitButton>
    </form>
  );
}
