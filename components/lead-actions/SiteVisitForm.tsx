"use client";

import { useActionState } from "react";
import { setSiteVisitDate } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";
import { toDateTimeLocal } from "@/lib/format";

export function SiteVisitForm({ leadId, siteVisitDate }: { leadId: string; siteVisitDate: string | null }) {
  const [state, formAction] = useActionState(setSiteVisitDate, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="site_visit_date" className="block text-xs font-medium text-muted-foreground">
          Site visit date &amp; time
        </label>
        <input
          id="site_visit_date"
          name="site_visit_date"
          type="datetime-local"
          defaultValue={toDateTimeLocal(siteVisitDate)}
          className="mt-1 block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Save site visit
      </SubmitButton>
    </form>
  );
}
