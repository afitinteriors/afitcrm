"use client";

import { useState, type FormEvent } from "react";
import { startCall, resolveCallOutcome } from "@/lib/actions/calls";
import { telLink } from "@/lib/format";
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS, CALL_OUTCOME_EXEMPT_FROM_FOLLOWUP } from "@/lib/constants";
import type { CallOutcome } from "@/lib/supabase/types";

type Props = {
  leadId: string;
  phone: string;
  customerName: string | null;
  // Set only when reopening a call that was already started in a
  // previous session (PendingCallGate) -- skips straight to the outcome
  // form. onClose is omitted in that case too, since R-CALL-001 means
  // once "Call now" has been pressed the popup cannot be closed without a
  // valid outcome, reload or not.
  initialCallLogId?: string | null;
  // R-CALL-002 (docs/BLUEPRINT_V1.md Blueprint V1): "except Wrong number
  // and Lost" -- mirrors the identical exemption resolveCallOutcome()
  // enforces server-side (and the DB trigger backing it) purely so this
  // form doesn't block a submit the server would accept anyway. The
  // server-side check is still the real one -- this is UI-only, never
  // trusted as the actual rule.
  leadAlreadyLost?: boolean;
  onClose?: () => void;
  onResolved: () => void;
};

// The one popup every Call surface in the app opens (CallButton,
// PendingCallGate) -- R-CALL-001 / R-CALL-002 (docs/BLUEPRINT_V1.md Phase
// 3). Two phases: "confirm" (Call now / Cancel, nothing saved yet) and
// "resolving" (the outcome form, no way out except a valid submit) --
// which phase is showing is just derived from whether callLogId is set,
// not a separate piece of state to keep in sync.
export function CallOutcomeModal({ leadId, phone, customerName, initialCallLogId = null, leadAlreadyLost = false, onClose, onResolved }: Props) {
  const [callLogId, setCallLogId] = useState<string | null>(initialCallLogId);
  const [starting, setStarting] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | "">("");
  const [notes, setNotes] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateRequired = outcome !== "" && outcome !== CALL_OUTCOME_EXEMPT_FROM_FOLLOWUP && !leadAlreadyLost;

  async function handleCallNow() {
    // Open the dialer synchronously, in the same click, before awaiting
    // anything -- some mobile browsers refuse a tel: navigation once the
    // user-gesture context has broken across an await.
    window.location.href = telLink(phone);
    setStarting(true);
    setError(null);
    const result = await startCall(leadId);
    setStarting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCallLogId(result.callLogId);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!callLogId || !outcome) return;
    if (dateRequired && !nextDate) {
      setError("Pick a next follow-up date.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await resolveCallOutcome(callLogId, outcome, notes, nextDate);
    setSubmitting(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onResolved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Call outcome">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
        <h2 className="text-base font-semibold text-foreground">Call {customerName || "lead"}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{phone}</p>

        {callLogId === null ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              Tap &quot;Call now&quot; to dial. You&apos;ll be asked to log the outcome right after.
            </p>
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex gap-2">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 flex-1 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={handleCallNow}
                disabled={starting}
                className="min-h-11 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {starting ? "Starting…" : "Call now"}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm font-medium text-foreground">How did the call go?</p>
            <div className="space-y-1.5" role="radiogroup" aria-label="Call outcome">
              {CALL_OUTCOMES.map((value) => (
                <label
                  key={value}
                  className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${
                    outcome === value ? "border-primary bg-primary/5 font-medium" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={value}
                    checked={outcome === value}
                    onChange={() => setOutcome(value)}
                    className="h-4 w-4"
                  />
                  {CALL_OUTCOME_LABELS[value]}
                </label>
              ))}
            </div>

            {outcome && (
              <div>
                <label htmlFor="call-next-date" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Next follow-up date{dateRequired ? "" : " (optional)"}
                </label>
                <input
                  id="call-next-date"
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                  className="mt-1 block min-h-11 w-full rounded-md border border-border px-3 text-sm"
                />
              </div>
            )}

            <div>
              <label htmlFor="call-notes" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes (optional)
              </label>
              <textarea
                id="call-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !outcome}
              className="min-h-11 w-full rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save outcome"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
