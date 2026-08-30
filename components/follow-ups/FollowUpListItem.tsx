import Link from "next/link";
import { formatDate } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";
import type { FollowUpListItem as FollowUpListItemData } from "@/lib/follow-ups";

function formatDueTime(dueTime: string | null): string {
  if (!dueTime) return "";
  return dueTime.slice(0, 5);
}

// The one row renderer shared by every section on both the desktop workspace
// and the mobile Today's tasks view -- neither surface builds its own item
// markup, matching the "two thin UI layers over one data layer" requirement
// for this phase.
export function FollowUpListItem({
  followUp,
  showAssignee,
}: {
  followUp: FollowUpListItemData;
  showAssignee: boolean;
}) {
  const leadName = followUp.lead?.customer_name || "Unnamed lead";
  const isCompleted = followUp.status === "completed";
  const dueTime = formatDueTime(followUp.due_time);

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
        isCompleted ? "border-border bg-muted" : "border-border"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            isCompleted ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {FOLLOW_UP_TYPE_LABELS[followUp.type]}
        </p>
        <Link href={`/leads/${followUp.lead_id}`} className="text-xs text-primary hover:underline">
          {leadName}
        </Link>
        <p className="text-xs text-muted-foreground">
          {formatDate(followUp.due_date)}
          {dueTime ? ` · ${dueTime}` : ""}
          {showAssignee && followUp.assigned?.display_name ? ` · ${followUp.assigned.display_name}` : ""}
        </p>
        {followUp.notes && <p className="mt-1 text-xs text-muted-foreground">{followUp.notes}</p>}
      </div>
      {!isCompleted && <CompleteFollowUpButton followUpId={followUp.id} leadId={followUp.lead_id} />}
    </div>
  );
}
