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

export function FollowUpsCard({ leadId, followUps }: { leadId: string; followUps: FollowUpRow[] }) {
  const pending = followUps.filter((f) => f.status === "pending");
  const completed = followUps.filter((f) => f.status === "completed");

  return (
    <Card title="Follow-ups">
      <div className="space-y-2">
        {pending.length === 0 && completed.length === 0 && (
          <p className="text-sm text-slate-500">No follow-ups yet.</p>
        )}

        {pending.map((followUp) => {
          const overdue = isFollowUpOverdue(followUp);
          return (
            <div
              key={followUp.id}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {FOLLOW_UP_TYPE_LABELS[followUp.type]}
                  {overdue && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                      Overdue
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(followUp.due_date)}
                  {formatDueTime(followUp.due_time) ? ` · ${formatDueTime(followUp.due_time)}` : ""}
                </p>
                {followUp.notes && <p className="mt-1 text-xs text-slate-600">{followUp.notes}</p>}
              </div>
              <CompleteFollowUpButton followUpId={followUp.id} leadId={leadId} />
            </div>
          );
        })}

        {completed.length > 0 && (
          <details className="pt-1">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">
              Completed ({completed.length})
            </summary>
            <div className="mt-2 space-y-2">
              {completed.map((followUp) => (
                <div key={followUp.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-sm text-slate-500 line-through">{FOLLOW_UP_TYPE_LABELS[followUp.type]}</p>
                  <p className="text-xs text-slate-400">{formatDate(followUp.due_date)}</p>
                  {followUp.notes && <p className="mt-1 text-xs text-slate-500">{followUp.notes}</p>}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <CreateFollowUpForm leadId={leadId} />
      </div>
    </Card>
  );
}
