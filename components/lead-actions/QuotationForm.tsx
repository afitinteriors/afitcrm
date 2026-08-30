"use client";

import { useActionState } from "react";
import { setQuotationAmount } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";

export function QuotationForm({
  leadId,
  quotationAmount,
}: {
  leadId: string;
  quotationAmount: number | null;
}) {
  const [state, formAction] = useActionState(setQuotationAmount, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <div>
        <label htmlFor="quotation_amount" className="block text-xs font-medium text-muted-foreground">
          Quotation amount (₹)
        </label>
        <input
          id="quotation_amount"
          name="quotation_amount"
          type="number"
          min="0"
          step="1"
          defaultValue={quotationAmount ?? ""}
          className="mt-1 block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <SubmitButton
        className="h-11 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
        pendingLabel="Saving…"
      >
        Save quotation
      </SubmitButton>
    </form>
  );
}
