"use client";

import { useActionState } from "react";
import { completeFollowUp } from "@/lib/actions/follow-ups";
import { SubmitButton } from "@/components/SubmitButton";

export function CompleteFollowUpButton({ followUpId, leadId }: { followUpId: string; leadId: string }) {
  const [state, formAction] = useActionState(completeFollowUp, null);

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="follow_up_id" value={followUpId} />
      <input type="hidden" name="lead_id" value={leadId} />
      {state?.error && <p className="mb-1 text-xs text-red-600">{state.error}</p>}
      <SubmitButton
        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Complete
      </SubmitButton>
    </form>
  );
}
