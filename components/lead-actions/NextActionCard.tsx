import { Card } from "@/components/Card";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";
import { isFollowUpOverdue } from "@/lib/follow-up-status";
import { formatDate } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import type { FollowUpRow } from "@/lib/supabase/types";

// Answers "what should I do now?" -- the single most important pending
// action, promoted out of the header into its own section rather than a
// small inline link. This is the ONLY place on the page that surfaces a
// specific follow-up as "the next thing to do"; the full list (including
// completed ones and the ability to schedule more) still lives solely in
// the Follow-ups card under WORK -- this just points at it and lets staff
// act on the single most urgent one without scrolling.
export function NextActionCard({ leadId, nextFollowUp }: { leadId: string; nextFollowUp: FollowUpRow | null }) {
  if (!nextFollowUp) {
    return (
      <Card title="Next Action">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-sm text-muted-foreground">No pending follow-up.</span>
          <a
            href="#follow-ups"
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            Schedule one
          </a>
        </div>
      </Card>
    );
  }

  const overdue = isFollowUpOverdue(nextFollowUp);

  return (
    <Card title="Next Action">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {FOLLOW_UP_TYPE_LABELS[nextFollowUp.type]}
            {overdue && (
              <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
                Overdue
              </span>
            )}
          </p>
          <p className={`text-xs ${overdue ? "text-danger" : "text-muted-foreground"}`}>
            {overdue ? "Due" : "Due"} {formatDate(nextFollowUp.due_date)}
          </p>
          {nextFollowUp.notes && <p className="mt-1 text-sm text-muted-foreground">{nextFollowUp.notes}</p>}
        </div>
        <CompleteFollowUpButton followUpId={nextFollowUp.id} leadId={leadId} />
      </div>
      <a
        href="#follow-ups"
        className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
      >
        View all follow-ups →
      </a>
    </Card>
  );
}
