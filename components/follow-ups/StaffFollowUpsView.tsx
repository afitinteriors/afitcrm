import { DoThisNowCard } from "@/components/dashboard/DoThisNowCard";
import { DutyList } from "@/components/dashboard/DutyList";
import { FollowUpsFilterBar } from "@/components/follow-ups/FollowUpsFilterBar";
import { FollowUpsSection } from "@/components/follow-ups/FollowUpsSection";
import { FollowUpListItem } from "@/components/follow-ups/FollowUpListItem";
import type { DutyQueue } from "@/lib/dashboard-brain";
import type { FollowUpGroups } from "@/lib/follow-up-status";
import type { FollowUpListItem as FollowUpListItemData } from "@/lib/follow-ups";
import type { StaffOption } from "@/lib/staff";

// Staff's own "what should I do next" workspace. Two data sources, kept
// visually and conceptually distinct per docs/strategy/follow-up-brain/
// 01 (Follow-Up vs. Next Required Action are different concepts):
//
// 1. Literal scheduled follow_ups (existing model, untouched) -- Overdue/
//    Today/Upcoming/Completed, exactly as before this phase.
// 2. System-derived attention with NO follow-up row at all -- an
//    unanswered WhatsApp message, a brand-new uncontacted lead, or any
//    other active lead nobody has scheduled anything for. These can never
//    overlap with (1): lib/dashboard-brain.ts's getMyDutyQueue() only
//    classifies a lead into "no_follow_up"/"uncontacted_lead" when it has
//    zero pending follow_ups rows, so a lead never appears in both lists.
export function StaffFollowUpsView({
  queue,
  groups,
  status,
  type,
  assignedTo,
  staffOptions,
}: {
  queue: DutyQueue;
  groups: FollowUpGroups<FollowUpListItemData>;
  status: string;
  type: string;
  assignedTo: string;
  staffOptions: StaffOption[];
}) {
  const needsNextStep = queue.items.filter(
    (i) => i.reasonKind === "unanswered_conversation" || i.reasonKind === "uncontacted_lead" || i.reasonKind === "no_follow_up",
  );
  const topItem = queue.items[0] ?? null;

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">My Follow-ups</h1>
      <p className="mt-1 text-sm text-muted-foreground">Follow-ups on leads assigned to you, plus anything that needs a next step.</p>

      {/* ---------- Desktop ---------- */}
      <div className="hidden lg:block">
        <div className="mt-4">
          <DoThisNowCard item={topItem} />
        </div>

        {needsNextStep.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Needs a Next Step</h2>
              <p className="text-xs text-muted-foreground">Active leads with no follow-up scheduled yet -- not a literal follow-up, a gap.</p>
            </div>
            <DutyList items={needsNextStep} emptyLabel="Nothing." />
          </div>
        )}

        <div className="mt-4">
          <FollowUpsFilterBar status={status} type={type} assignedTo={assignedTo} staffOptions={staffOptions} />
        </div>

        <div className="mt-4">
          <FollowUpsSection title="Overdue" items={groups.overdue} showAssignee={false} emptyLabel="Nothing overdue." />
          <FollowUpsSection title="Today" items={groups.today} showAssignee={false} emptyLabel="Nothing due today." />
          <FollowUpsSection title="Upcoming" items={groups.upcoming} showAssignee={false} emptyLabel="Nothing scheduled." />

          {groups.completed.length > 0 && (
            <details className="mt-4">
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
      </div>

      {/* ---------- Mobile: dominant current action + compact queue only ---------- */}
      <div className="mt-4 space-y-4 lg:hidden">
        <DoThisNowCard item={topItem} />

        {groups.overdue.length === 0 && groups.today.length === 0 && needsNextStep.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            All caught up for today.
          </div>
        ) : (
          <>
            <FollowUpsSection title="Overdue" items={groups.overdue} showAssignee={false} />
            <FollowUpsSection title="Today" items={groups.today} showAssignee={false} />
            {needsNextStep.length > 0 && (
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs a Next Step</h2>
                </div>
                <DutyList items={needsNextStep} emptyLabel="Nothing." />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
