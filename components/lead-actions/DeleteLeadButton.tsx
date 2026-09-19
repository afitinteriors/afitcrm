"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteLead } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";

// Explicit two-step confirmation for an irreversible, admin-only action --
// same role="dialog"/Escape-to-close convention as
// components/settings/NumberFormModal.tsx. The button that opens this is
// visually secondary (outlined, not filled) until the moment of actually
// confirming, where the real destructive action gets the only filled/danger
// button in the dialog -- Cancel stays visually neutral so the two are never
// confusable.
export function DeleteLeadButton({
  leadId,
  customerName,
  phone,
}: {
  leadId: string;
  customerName: string | null;
  phone: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteLead, null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center rounded-md border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger-soft"
      >
        Delete Lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete lead"
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
          >
            <h2 className="text-sm font-semibold text-foreground">Delete this lead?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{customerName || "Unnamed lead"}</span> · {phone}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently deletes the lead along with its conversation, messages, and follow-ups. This cannot
              be undone.
            </p>

            {state?.error && <p className="mt-3 text-sm font-medium text-danger">{state.error}</p>}

            <form action={formAction} className="mt-4 flex justify-end gap-2">
              <input type="hidden" name="lead_id" value={leadId} />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <SubmitButton
                className="flex h-11 items-center rounded-md bg-danger px-4 text-sm font-medium text-danger-foreground hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
                pendingLabel="Deleting…"
              >
                Delete Lead
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
