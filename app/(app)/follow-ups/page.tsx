import { getFollowUps } from "@/lib/follow-ups";
import { groupFollowUpsByDueDate } from "@/lib/follow-up-status";
import { getAssignableStaff } from "@/lib/staff";
import { getCurrentProfile } from "@/lib/auth";
import { FollowUpsFilterBar } from "@/components/follow-ups/FollowUpsFilterBar";
import { FollowUpsSection } from "@/components/follow-ups/FollowUpsSection";
import { FollowUpListItem } from "@/components/follow-ups/FollowUpListItem";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; assignedTo?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "pending";
  const type = params.type ?? "";
  const assignedTo = params.assignedTo ?? "";

  // getAssignableStaff() already returns [] for a non-admin caller (lib/
  // staff.ts) -- that's what makes the assignee filter disappear for staff
  // below, not a role check duplicated here.
  const [followUps, profile, staffOptions] = await Promise.all([
    getFollowUps({ status, type, assignedTo }),
    getCurrentProfile(),
    getAssignableStaff(),
  ]);

  const isAdmin = profile?.role === "admin";
  const groups = groupFollowUpsByDueDate(followUps);
  const heading = isAdmin ? "Follow-ups" : "My Follow-ups";
  const description = isAdmin
    ? "Every scheduled follow-up across your team."
    : "Follow-ups on leads assigned to you.";

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{heading}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      {/* Desktop: full filterable workspace -- all four buckets. */}
      <div className="hidden lg:block">
        <div className="mt-4">
          <FollowUpsFilterBar status={status} type={type} assignedTo={assignedTo} staffOptions={staffOptions} />
        </div>

        <div className="mt-4">
          <FollowUpsSection title="Overdue" items={groups.overdue} showAssignee={isAdmin} emptyLabel="Nothing overdue." />
          <FollowUpsSection title="Today" items={groups.today} showAssignee={isAdmin} emptyLabel="Nothing due today." />
          <FollowUpsSection title="Upcoming" items={groups.upcoming} showAssignee={isAdmin} emptyLabel="Nothing scheduled." />

          {groups.completed.length > 0 && (
            <details className="mt-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Completed ({groups.completed.length})
              </summary>
              <div className="mt-2 space-y-2">
                {groups.completed.map((item) => (
                  <FollowUpListItem key={item.id} followUp={item} showAssignee={isAdmin} />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Mobile: Today's tasks only -- overdue + due today, no filter chrome,
          matching §1's "what a salesperson needs during the day" scope. */}
      <div className="mt-4 lg:hidden">
        {groups.overdue.length === 0 && groups.today.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
            All caught up for today.
          </div>
        ) : (
          <>
            <FollowUpsSection title="Overdue" items={groups.overdue} showAssignee={isAdmin} />
            <FollowUpsSection title="Today" items={groups.today} showAssignee={isAdmin} />
          </>
        )}
      </div>
    </div>
  );
}
