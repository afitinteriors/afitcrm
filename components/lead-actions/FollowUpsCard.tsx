import { Card } from "@/components/Card";
import { isFollowUpOverdue } from "@/lib/follow-up-status";
import { formatDate } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import type { FollowUpRow } from "@/lib/supabase/types";
import { CreateFollowUpForm } from "@/components/lead-actions/CreateFollowUpForm";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";

function formatDueTime(dueTime: string | null): string {
  if (!dueTime) return "";
  return dueTime.slice(0, 5);
}

function isDueToday(dueDate: string): boolean {
  return dueDate === new Date().toISOString().slice(0, 10);
}

export function FollowUpsCard({ leadId, followUps }: { leadId: string; followUps: FollowUpRow[] }) {
  const pending = followUps.filter((f) => f.status === "pending");
  const completed = followUps.filter((f) => f.status === "completed");

  return (
    <Card title="Follow-ups">
      <div className="space-y-2">
        {pending.length === 0 && completed.length === 0 && (
          <p className="text-sm text-muted-foreground">No follow-ups yet.</p>
        )}

        {pending.map((followUp) => {
          const overdue = isFollowUpOverdue(followUp);
          const dueToday = !overdue && isDueToday(followUp.due_date);
          return (
            <div
              key={followUp.id}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                overdue ? "border-danger/30 bg-danger-soft/40" : "border-border"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {FOLLOW_UP_TYPE_LABELS[followUp.type]}
                  {overdue && (
                    <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
                      Overdue
                    </span>
                  )}
                  {dueToday && (
                    <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                      Due today
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(followUp.due_date)}
                  {formatDueTime(followUp.due_time) ? ` · ${formatDueTime(followUp.due_time)}` : ""}
                </p>
                {followUp.notes && <p className="mt-1 text-xs text-muted-foreground">{followUp.notes}</p>}
              </div>
              <CompleteFollowUpButton followUpId={followUp.id} leadId={leadId} />
            </div>
          );
        })}

        {completed.length > 0 && (
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-muted-foreground">
              Completed ({completed.length})
            </summary>
            <div className="mt-2 space-y-2">
              {completed.map((followUp) => (
                <div key={followUp.id} className="rounded-md border border-border bg-muted px-3 py-2">
                  <p className="text-sm text-muted-foreground line-through">{FOLLOW_UP_TYPE_LABELS[followUp.type]}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(followUp.due_date)}</p>
                  {followUp.notes && <p className="mt-1 text-xs text-muted-foreground">{followUp.notes}</p>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <CreateFollowUpForm leadId={leadId} />
      </div>
    </Card>
  );
}
