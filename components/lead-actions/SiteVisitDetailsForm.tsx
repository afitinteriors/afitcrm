"use client";

import { useActionState } from "react";
import { setSiteVisitDetails } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";

export function SiteVisitDetailsForm({
  leadId,
  measurements,
  photoReference,
}: {
  leadId: string;
  measurements: string | null;
  photoReference: string | null;
}) {
  const [state, formAction] = useActionState(setSiteVisitDetails, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="site_visit_measurements" className="block text-xs font-medium text-surface-foreground-muted">
          Measurements
        </label>
        <textarea
          id="site_visit_measurements"
          name="site_visit_measurements"
          rows={2}
          defaultValue={measurements ?? ""}
          placeholder="e.g. 1500 sqft, 3 rooms, 9ft ceiling"
          className="mt-1 block w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label htmlFor="site_visit_photo_reference" className="block text-xs font-medium text-surface-foreground-muted">
          Photo reference
        </label>
        <input
          id="site_visit_photo_reference"
          name="site_visit_photo_reference"
          type="text"
          defaultValue={photoReference ?? ""}
          placeholder="e.g. link to shared album, or a short note"
          className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md border border-white/15 px-3 text-xs font-medium text-surface-foreground hover:bg-white/10 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Save visit details
      </SubmitButton>
    </form>
  );
}
