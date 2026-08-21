"use client";

import { useActionState } from "react";
import { markLeadLost, markLeadWon } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";

export function MarkWonForm({ leadId, jobValue }: { leadId: string; jobValue: number | null }) {
  const [state, formAction] = useActionState(markLeadWon, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="won_job_value" className="block text-xs font-medium text-slate-500">
          Job value (₹, optional)
        </label>
        <input
          id="won_job_value"
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
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Mark as Won
      </SubmitButton>
    </form>
  );
}

export function MarkLostForm({ leadId, lostReason }: { leadId: string; lostReason: string | null }) {
  const [state, formAction] = useActionState(markLeadLost, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="lost_reason" className="block text-xs font-medium text-slate-500">
          Lost reason
        </label>
        <textarea
          id="lost_reason"
          name="lost_reason"
          defaultValue={lostReason ?? ""}
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <SubmitButton
        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Mark as Lost
      </SubmitButton>
    </form>
  );
}
