"use client";

import { useActionState, useEffect, useRef } from "react";
import { createFollowUp } from "@/lib/actions/follow-ups";
import { SubmitButton } from "@/components/SubmitButton";
import { FOLLOW_UP_TYPES, FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";

export function CreateFollowUpForm({ leadId }: { leadId: string }) {
  const [state, formAction, isPending] = useActionState(createFollowUp, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="follow_up_type" className="block text-xs font-medium text-slate-500">
          Type
        </label>
        <select
          id="follow_up_type"
          name="type"
          defaultValue="follow_up"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {FOLLOW_UP_TYPES.map((type) => (
            <option key={type} value={type}>
              {FOLLOW_UP_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="due_date" className="block text-xs font-medium text-slate-500">
            Due date
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="due_time" className="block text-xs font-medium text-slate-500">
            Due time (optional)
          </label>
          <input
            id="due_time"
            name="due_time"
            type="time"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </div>
      <div>
        <label htmlFor="follow_up_notes" className="block text-xs font-medium text-slate-500">
          Notes (optional)
        </label>
        <textarea
          id="follow_up_notes"
          name="notes"
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <SubmitButton
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        pendingLabel="Adding…"
      >
        Add follow-up
      </SubmitButton>
    </form>
  );
}
