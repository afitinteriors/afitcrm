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
        <label htmlFor="site_visit_date" className="block text-xs font-medium text-slate-500">
          Site visit date &amp; time
        </label>
        <input
          id="site_visit_date"
          name="site_visit_date"
          type="datetime-local"
          defaultValue={toDateTimeLocal(siteVisitDate)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <SubmitButton
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Save site visit
      </SubmitButton>
    </form>
  );
}
