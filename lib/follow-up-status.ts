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
