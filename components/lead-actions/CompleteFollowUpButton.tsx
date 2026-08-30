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
      {state?.error && <p className="mb-1 text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="flex h-11 items-center justify-center rounded-md bg-success px-3 text-xs font-medium text-success-foreground hover:bg-success/90 disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Complete
      </SubmitButton>
    </form>
  );
}
