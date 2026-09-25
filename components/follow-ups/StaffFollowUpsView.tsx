import type { ReactNode } from "react";
import { FollowUpsFilterBar } from "@/components/follow-ups/FollowUpsFilterBar";
import { FollowUpListItem } from "@/components/follow-ups/FollowUpListItem";
import type { FollowUpGroups } from "@/lib/follow-up-status";
import type { FollowUpListItem as FollowUpListItemData } from "@/lib/follow-ups";
import type { StaffOption } from "@/lib/staff";

type Tone = "now" | "today" | "upcoming";

const ACCENT: Record<Tone, { dot: string; count: string }> = {
  now: { dot: "bg-danger", count: "bg-danger-soft text-danger" },
  today: { dot: "bg-warning", count: "bg-warning-soft text-warning" },
  upcoming: { dot: "bg-muted-foreground/60", count: "bg-muted text-muted-foreground" },
};

function Section({
  id,
  title,
  tone,
  items,
  empty,
}: {
  id: string;
  title: string;
  tone: Tone;
  items: FollowUpListItemData[];
  empty: string;
}) {
  const accent = ACCENT[tone];
  return (
    <section aria-labelledby={`${id}-title`} data-testid={`staff-tasks-${id}`}>
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} aria-hidden="true" />
        <h2 id={`${id}-title`} className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h2>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${items.length > 0 ? accent.count : "bg-muted text-muted-foreground"}`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <FollowUpListItem key={item.id} followUp={item} showAssignee={false} />
          ))}
        </div>
      )}
    </section>
  );
}

// Staff Tasks tab: scheduled follow-ups only -- the real follow_ups rows, each
// with its Complete action -- most urgent first: now (overdue), today,
// upcoming. New leads and other open work live on the Staff Home, not here.
// Desktop keeps the existing status/type filter and the Completed history.
export function StaffFollowUpsView({
  groups,
  status,
  type,
  assignedTo,
  staffOptions,
}: {
  groups: FollowUpGroups<FollowUpListItemData>;
  status: string;
  type: string;
  assignedTo: string;
  staffOptions: StaffOption[];
}) {
  const nothingDue = groups.overdue.length + groups.today.length === 0;

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">My Follow-ups</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {nothingDue ? "You're all caught up — nothing overdue or due today." : "Your scheduled follow-ups, most urgent first."}
      </p>

      <div className="mt-4 hidden lg:block">
        <FollowUpsFilterBar status={status} type={type} assignedTo={assignedTo} staffOptions={staffOptions} />
      </div>

      <div className="mt-5 space-y-6">
        <Section id="follow-up-now" title="Follow up now" tone="now" items={groups.overdue} empty="No overdue follow-ups." />
        <Section id="follow-up-today" title="Follow up today" tone="today" items={groups.today} empty="Nothing due today." />
        <Section id="upcoming" title="Upcoming" tone="upcoming" items={groups.upcoming} empty="Nothing scheduled." />
      </div>

      {groups.completed.length > 0 && (
        <details className="mt-6 hidden lg:block">
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Completed ({groups.completed.length})
          </summary>
          <div className="mt-2 space-y-2">
            {groups.completed.map((item) => (
              <FollowUpListItem key={item.id} followUp={item} showAssignee={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
