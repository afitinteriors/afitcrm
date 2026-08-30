import type { FollowUpRow } from "@/lib/supabase/types";

// Overdue is derived, not stored, so it can never drift out of sync with
// due_date/status. Kept in its own module with no server-only imports so
// client components (e.g. DashboardFollowUps) can use it without pulling
// lib/follow-ups.ts's Supabase/next-headers chain into the client bundle.
export function isFollowUpOverdue(followUp: Pick<FollowUpRow, "status" | "due_date">): boolean {
  if (followUp.status !== "pending") return false;
  const today = new Date().toISOString().slice(0, 10);
  return followUp.due_date < today;
}

export type FollowUpGroups<T> = {
  overdue: T[];
  today: T[];
  upcoming: T[];
  completed: T[];
};

// Shared by the Follow-ups workspace's desktop sections and mobile Today's
// tasks view -- one grouping pass over one fetched list, not two separate
// queries. A non-pending item always lands in `completed` regardless of its
// due_date, matching isFollowUpOverdue's own "completed is never overdue"
// rule above -- there's no reason a finished task should ever show as
// overdue/today/upcoming.
export function groupFollowUpsByDueDate<T extends Pick<FollowUpRow, "status" | "due_date">>(
  items: T[]
): FollowUpGroups<T> {
  const today = new Date().toISOString().slice(0, 10);
  const groups: FollowUpGroups<T> = { overdue: [], today: [], upcoming: [], completed: [] };

  for (const item of items) {
    if (item.status !== "pending") {
      groups.completed.push(item);
    } else if (item.due_date < today) {
      groups.overdue.push(item);
    } else if (item.due_date === today) {
      groups.today.push(item);
    } else {
      groups.upcoming.push(item);
    }
  }

  return groups;
}
