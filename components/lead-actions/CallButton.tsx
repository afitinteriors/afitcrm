"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CallOutcomeModal } from "@/components/lead-actions/CallOutcomeModal";

type Props = {
  leadId: string;
  phone: string;
  customerName?: string | null;
  // R-CALL-002: the lead's current pipeline status, when the caller has it
  // on hand -- a lead already at Lost waives the next-follow-up-date
  // requirement (same exemption as Wrong number) in the popup this opens.
  // Optional and only ever loosens a client-side convenience check; the
  // server (resolveCallOutcome + the DB trigger) decides this for real.
  leadStatus?: string | null;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type" | "children">;

// Single source of truth for R-CALL-001 (docs/BLUEPRINT_V1.md Phase 3):
// every Call action on a lead renders this, not a bare tel: link, so the
// mandatory outcome popup can never be skipped from any surface. It is a
// <button> rather than an <a> because the click's primary job is opening
// the popup -- the actual tel: navigation happens from inside the modal,
// once "Call now" is pressed there.
export function CallButton({ leadId, phone, customerName = null, leadStatus = null, children, ...rest }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} {...rest}>
        {children}
      </button>
      {open && (
        <CallOutcomeModal
          leadId={leadId}
          phone={phone}
          customerName={customerName}
          leadAlreadyLost={leadStatus === "lost"}
          onClose={() => setOpen(false)}
          onResolved={() => setOpen(false)}
        />
      )}
    </>
  );
}
