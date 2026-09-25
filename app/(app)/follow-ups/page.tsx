import { getFollowUps } from "@/lib/follow-ups";
import { groupFollowUpsByDueDate } from "@/lib/follow-up-status";
import { getAssignableStaff } from "@/lib/staff";
import { getCurrentProfile } from "@/lib/auth";
import { getMyDutyQueue, getUnassignedLeads, getStalledPipelineLeads } from "@/lib/dashboard-brain";
import { StaffFollowUpsView } from "@/components/follow-ups/StaffFollowUpsView";
import { AdminFollowUpsView } from "@/components/follow-ups/AdminFollowUpsView";

// Phase B: the dedicated Follow-up Brain workspace. See
// docs/strategy/follow-up-brain/ -- Admin and Staff get genuinely separate
// views (StaffFollowUpsView / AdminFollowUpsView), not one page with
// sections hidden, matching the same discipline Phase A established for
// /dashboard. The existing follow_ups model (filters, create, complete)
// is reused unchanged; this only adds the system-derived "no follow-up
// exists yet" signals alongside it.
export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; assignedTo?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "pending";
  const type = params.type ?? "";
  const assignedTo = params.assignedTo ?? "";

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const [followUps, staffOptions, queue] = await Promise.all([
    getFollowUps({ status, type, assignedTo }),
    getAssignableStaff(),
    getMyDutyQueue(),
  ]);
  const groups = groupFollowUpsByDueDate(followUps);

  if (isAdmin) {
    const [unassigned, stalled] = await Promise.all([getUnassignedLeads(), getStalledPipelineLeads()]);
    return (
      <AdminFollowUpsView
        queue={queue}
        groups={groups}
        unassigned={unassigned}
        stalled={stalled}
        status={status}
        type={type}
        assignedTo={assignedTo}
        staffOptions={staffOptions}
      />
    );
  }

  return (
    <StaffFollowUpsView
      groups={groups}
      status={status}
      type={type}
      assignedTo={assignedTo}
      staffOptions={staffOptions}
    />
  );
}
