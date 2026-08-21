"use client";

import { useActionState } from "react";
import { setJobValue } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";

export function JobValueForm({ leadId, jobValue }: { leadId: string; jobValue: number | null }) {
  const [state, formAction] = useActionState(setJobValue, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="job_value" className="block text-xs font-medium text-slate-500">
          Job value (₹)
        </label>
        <input
          id="job_value"
          name="job_value"
          type="number"
          min="0"
          step="1"
          defaultValue={jobValue ?? ""}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <SubmitButton
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Save job value
      </SubmitButton>
    </form>
  );
}
