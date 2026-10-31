"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MarkLostForm, MarkWonForm } from "@/components/lead-actions/WonLostForms";
import { canMarkWon } from "@/lib/lead-stage-sections";
import type { LeadStatus, LostReasonCategory } from "@/lib/supabase/types";

// Confirm-modal entry points for the only two writes that close a lead --
// markLeadWon()/markLeadLost() themselves are untouched (MarkWonForm/
// MarkLostForm, imported as-is). This only changes HOW staff reach those
// forms: a deliberate "are you sure" step (same role="dialog"/Escape-to-
// close convention as DeleteLeadButton/NumberFormModal) instead of an
// always-expanded <details> section, so Mark Won/Lost reads as a
// considered action rather than a stray button (Blueprint V1 Decisions,
// CLAUDE.md, 2026-10-31).
export function CloseLeadActions({
  leadId,
  customerName,
  status,
  jobValue,
  lostReason,
  lostReasonCategory,
}: {
  leadId: string;
  customerName: string | null;
  status: LeadStatus;
  jobValue: number | null;
  lostReason: string | null;
  lostReasonCategory: LostReasonCategory | null;
}) {
  const [openModal, setOpenModal] = useState<"won" | "lost" | null>(null);
  const wonOfferable = canMarkWon(status);
  // "won" is already closed -- the only remaining close action is a
  // correction, not a fresh "mark lost" (same distinction the old
  // <details> summary made: "Correct to Lost" vs "Mark Won / Lost").
  const lostButtonLabel = status === "won" ? "Correct to lost" : "Mark lost";

  useEffect(() => {
    if (!openModal) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenModal(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openModal]);

  return (
    <div className="flex gap-2">
      {wonOfferable && (
        <button
          type="button"
          onClick={() => setOpenModal("won")}
          className="flex h-11 flex-1 items-center justify-center rounded-md bg-success px-3 text-sm font-medium text-success-foreground hover:bg-success/90"
        >
          Mark won
        </button>
      )}
      <button
        type="button"
        onClick={() => setOpenModal("lost")}
        className="flex h-11 flex-1 items-center justify-center rounded-md border border-danger/40 px-3 text-sm font-medium text-danger hover:bg-danger-soft"
      >
        {lostButtonLabel}
      </button>

      {openModal &&
        createPortal(
          // Portalled to document.body -- this card sits inside the
          // backdrop-blur-sm contact panel, and `backdrop-filter` on an
          // ancestor makes it the containing block for a `position: fixed`
          // descendant (same as `transform`/`filter`), which otherwise
          // confines "fixed inset-0" to that ancestor's box instead of the
          // viewport. A portal escapes that entirely.
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={openModal === "won" ? "Mark lead as won" : "Mark lead as lost"}
              className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg"
            >
              <h2 className="text-sm font-semibold text-foreground">
                {openModal === "won" ? "Mark won" : lostButtonLabel}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{customerName || "Unnamed lead"}</p>

              <div className="mt-4">
                {openModal === "won" ? (
                  <MarkWonForm leadId={leadId} jobValue={jobValue} />
                ) : (
                  <MarkLostForm leadId={leadId} lostReason={lostReason} lostReasonCategory={lostReasonCategory} />
                )}
              </div>

              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-md border border-border text-sm font-medium text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
