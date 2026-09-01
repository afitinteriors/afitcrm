"use client";

import { useActionState, useEffect, useRef } from "react";
import { createService } from "@/lib/actions/automation-config";
import { SubmitButton } from "@/components/SubmitButton";

export function CreateServiceForm() {
  const [state, formAction, isPending] = useActionState(createService, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) {
      formRef.current?.reset();
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex-1">
        <label htmlFor="new_service_name" className="block text-xs font-medium text-muted-foreground">
          New service name
        </label>
        <input
          id="new_service_name"
          name="name"
          type="text"
          required
          placeholder="e.g. AC Repair"
          className="mt-1 block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        pendingLabel="Adding…"
      >
        Add service
      </SubmitButton>
    </form>
  );
}
