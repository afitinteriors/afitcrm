"use client";

import { useEffect, useState } from "react";
import { getMyPendingCall, type PendingCall } from "@/lib/actions/calls";
import { CallOutcomeModal } from "@/components/lead-actions/CallOutcomeModal";

// R-CALL-001 (docs/BLUEPRINT_V1.md Phase 3): if the outcome popup was open
// when the tab closed or the app lost focus, it must come back -- it is
// not optional. Mounted once at the app shell (app/(app)/layout.tsx) so it
// works no matter which page the caller lands on; call_logs_
// one_pending_per_caller (DB constraint) is what makes "the" pending call
// unambiguous, so there is never more than one to show.
export function PendingCallGate() {
  const [pending, setPending] = useState<PendingCall | null>(null);

  useEffect(() => {
    let cancelled = false;
    function check() {
      void getMyPendingCall().then((result) => {
        if (!cancelled) setPending(result);
      });
    }
    check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!pending) return null;

  return (
    <CallOutcomeModal
      leadId={pending.leadId}
      phone={pending.phone}
      customerName={pending.customerName}
      initialCallLogId={pending.id}
      leadAlreadyLost={pending.leadAlreadyLost}
      onResolved={() => setPending(null)}
    />
  );
}
