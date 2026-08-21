import type { LeadStatus } from "@/lib/supabase/types";
import { LEAD_STATUS_BADGE_CLASSES, LEAD_STATUS_LABELS } from "@/lib/constants";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${LEAD_STATUS_BADGE_CLASSES[status]}`}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
