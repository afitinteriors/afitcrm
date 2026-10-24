"use client";

import { useActionState } from "react";
import { setSiteVisitDate } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";
import { toBusinessDateTimeLocal } from "@/lib/business-time";

export function SiteVisitForm({ leadId, siteVisitDate }: { leadId: string; siteVisitDate: string | null }) {
  const [state, formAction] = useActionState(setSiteVisitDate, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="site_visit_date" className="block text-xs font-medium text-surface-foreground-muted">
          Site visit date &amp; time (IST)
        </label>
        <input
          id="site_visit_date"
          name="site_visit_date"
          type="datetime-local"
          defaultValue={toBusinessDateTimeLocal(siteVisitDate)}
          className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md border border-white/15 px-3 text-xs font-medium text-surface-foreground hover:bg-white/10 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Save site visit
      </SubmitButton>
    </form>
  );
}
