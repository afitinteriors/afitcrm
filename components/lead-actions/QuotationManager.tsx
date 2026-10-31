"use client";

import { useActionState } from "react";
import { approveQuotationDiscount, saveQuotationDraft, sendQuotation } from "@/lib/actions/quotations";
import { discountPercent, needsDiscountApproval } from "@/lib/quotation-discount";
import { DISCOUNT_APPROVAL_LIMIT_PERCENT } from "@/lib/constants";
import { SubmitButton } from "@/components/SubmitButton";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { QuotationRow } from "@/lib/supabase/types";

// R-QUOTE-001 (docs/BLUEPRINT_V1.md Section 8): "A sent quotation is never
// edited; a change creates a new version." `quotations` is newest-version
// first (lib/quotations.ts's getQuotationsForLead) -- [0] is "current".
// The caller passes key={quotations[0]?.id ?? "new"} so this remounts
// (resetting form state/defaultValue) whenever the latest version changes
// -- a new version created, or the current one flips draft -> sent. An
// approval alone does NOT change which row is "latest", so it does not
// need a remount -- the fresh `quotations` prop re-renders this in place.
export function QuotationManager({
  leadId,
  quotations,
  isAdmin,
}: {
  leadId: string;
  quotations: QuotationRow[];
  isAdmin: boolean;
}) {
  const latest = quotations[0] ?? null;
  const history = quotations.slice(1);
  const isDraft = latest?.status === "draft";

  const v1 = quotations.find((q) => q.version === 1) ?? null;
  // R-QUOTE-002 (docs/BLUEPRINT_V1.md Section 8): discount is measured
  // against v1 -- see lib/quotation-discount.ts for why. v1 itself is
  // never "discounted" against anything.
  const discountPct = latest && v1 && latest.version > 1 ? discountPercent(v1.amount, latest.amount) : 0;
  const needsApproval = needsDiscountApproval(discountPct, DISCOUNT_APPROVAL_LIMIT_PERCENT);
  const isApproved = Boolean(latest?.discount_approved_at);
  const blockedBySendGate = needsApproval && !isApproved;

  const [draftState, draftAction] = useActionState(saveQuotationDraft, null);
  const [sendState, sendAction] = useActionState(sendQuotation, null);
  const [approveState, approveAction] = useActionState(approveQuotationDiscount, null);

  return (
    <div className="space-y-4">
      {latest && (
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-surface-foreground">
              v{latest.version} · {formatCurrency(latest.amount)}
            </p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                latest.status === "sent" ? "bg-success/15 text-success" : "bg-white/10 text-surface-foreground-muted"
              }`}
            >
              {latest.status === "sent" ? "Sent" : "Draft"}
            </span>
          </div>
          {latest.notes && <p className="mt-1 text-xs text-surface-foreground-muted">{latest.notes}</p>}
          {latest.sent_at && <p className="mt-1 text-xs text-surface-foreground-muted">Sent {formatDateTime(latest.sent_at)}</p>}

          {needsApproval && (
            <p className={`mt-2 text-xs font-medium ${isApproved ? "text-success" : "text-warning"}`}>
              {isApproved
                ? `Discount ${Math.round(discountPct)}% approved`
                : `Discount ${Math.round(discountPct)}% exceeds the ${DISCOUNT_APPROVAL_LIMIT_PERCENT}% limit -- needs admin approval before it can be sent.`}
            </p>
          )}

          {isDraft && blockedBySendGate && isAdmin && (
            <form action={approveAction} className="mt-3">
              <input type="hidden" name="quotation_id" value={latest.id} />
              <input type="hidden" name="lead_id" value={leadId} />
              {approveState?.error && <p className="mb-2 text-xs text-danger">{approveState.error}</p>}
              <SubmitButton
                className="h-9 rounded-md border border-warning/40 px-3 text-xs font-medium text-warning hover:bg-warning/10 disabled:opacity-60"
                pendingLabel="Approving…"
              >
                Approve discount
              </SubmitButton>
            </form>
          )}

          {isDraft && !blockedBySendGate && (
            <form action={sendAction} className="mt-3">
              <input type="hidden" name="quotation_id" value={latest.id} />
              <input type="hidden" name="lead_id" value={leadId} />
              {sendState?.error && <p className="mb-2 text-xs text-danger">{sendState.error}</p>}
              <SubmitButton
                className="h-9 rounded-md bg-success px-3 text-xs font-medium text-success-foreground hover:bg-success/90 disabled:opacity-60"
                pendingLabel="Marking sent…"
              >
                Mark sent
              </SubmitButton>
            </form>
          )}
        </div>
      )}

      <form action={draftAction} className="space-y-3">
        <input type="hidden" name="lead_id" value={leadId} />
        <div>
          <label htmlFor="quotation_amount" className="block text-xs font-medium text-surface-foreground-muted">
            {isDraft ? "Edit draft amount (₹)" : latest ? "New version amount (₹)" : "Quotation amount (₹)"}
          </label>
          <input
            id="quotation_amount"
            name="amount"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={latest?.amount ?? ""}
            className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="quotation_notes" className="block text-xs font-medium text-surface-foreground-muted">
            Notes (optional)
          </label>
          <input
            id="quotation_notes"
            name="notes"
            type="text"
            defaultValue={isDraft ? (latest?.notes ?? "") : ""}
            placeholder={isDraft ? undefined : "What changed in this version?"}
            className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {draftState?.error && <p className="text-xs text-danger">{draftState.error}</p>}
        <SubmitButton
          className="h-11 rounded-md border border-white/15 px-3 text-xs font-medium text-surface-foreground hover:bg-white/10 disabled:opacity-60"
          pendingLabel="Saving…"
        >
          {isDraft ? "Save draft" : latest ? "Create new version" : "Save quotation"}
        </SubmitButton>
      </form>

      {history.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-surface-foreground-muted marker:hidden hover:text-surface-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            Version history ({history.length})
          </summary>
          <ul className="mt-2 space-y-1.5 border-t border-white/10 pt-2">
            {history.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-surface-foreground-muted">
                  v{q.version} · {formatCurrency(q.amount)}
                </span>
                <span className="shrink-0 text-surface-foreground-muted">
                  {q.status === "sent" && q.sent_at ? `Sent ${formatDateTime(q.sent_at)}` : "Draft (superseded)"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
