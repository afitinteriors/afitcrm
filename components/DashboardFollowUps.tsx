"use client";

import { useRouter } from "next/navigation";
import { isFollowUpOverdue } from "@/lib/follow-up-status";
import type { UpcomingFollowUp } from "@/lib/follow-ups";
import { formatDate } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";

function formatDueTime(dueTime: string | null): string {
  if (!dueTime) return "";
  return dueTime.slice(0, 5);
}

export function DashboardFollowUps({ followUps }: { followUps: UpcomingFollowUp[] }) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Follow-ups due</h2>
      </div>

      {followUps.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No follow-ups due</p>
      ) : (
        <ul className="divide-y divide-border">
          {followUps.map((followUp) => {
            const overdue = isFollowUpOverdue(followUp);
            const name = followUp.lead?.customer_name || "Unnamed lead";
            const href = `/leads/${followUp.lead_id}`;

            return (
              <li key={followUp.id}>
                {/* role="link" + onClick, not <Link>, to safely nest the
                    Complete form -- same pattern already used in
                    ConversationListPanel.tsx after wrapping-<Link> click
                    issues found earlier in this app. */}
                <div
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(href);
                  }}
                  className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary active:bg-secondary"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {FOLLOW_UP_TYPE_LABELS[followUp.type]} · {name}
                      {overdue && (
                        <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
                          Overdue
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(followUp.due_date)}
                      {formatDueTime(followUp.due_time) ? ` · ${formatDueTime(followUp.due_time)}` : ""}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <CompleteFollowUpButton followUpId={followUp.id} leadId={followUp.lead_id} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
