import { getCurrentProfile } from "@/lib/auth";
import { getMyDutyQueue, getStalledPipelineLeads, getUnassignedLeads, getStaffWorkload, getRecentLeads } from "@/lib/dashboard-brain";
import { getFollowUps } from "@/lib/follow-ups";
import { getLeads } from "@/lib/leads";
import { buildStaffHome } from "@/lib/staff-home";
import { StaffHome } from "@/components/dashboard/StaffHome";
import { AdminHome } from "@/components/dashboard/AdminHome";

// AFIT Follow-Up Brain -- Phase A (UI only, no schema change). Admin and
// Staff are genuinely different experiences here (see
// docs/strategy/follow-up-brain/06_IMPLEMENTATION_SCOPE_AND_GUARDRAILS.md
// §9/§11) -- this page only fetches the data each role's view needs and
// branches; StaffHome and AdminHome are not the same component with
// sections hidden.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const firstName = profile?.displayName?.split(" ")[0] ?? null;

  if (profile?.role === "admin") {
    const [queue, unassigned, stalled, workload, recent] = await Promise.all([
      getMyDutyQueue(),
      getUnassignedLeads(),
      getStalledPipelineLeads(),
      getStaffWorkload(),
      getRecentLeads(),
    ]);

    return <AdminHome queue={queue} unassigned={unassigned} stalled={stalled} workload={workload} recent={recent} />;
  }

  // Staff: the same canonical attention queue, plus the staff member's own
  // leads/pending follow-ups for display detail only (service, stage, due
  // time) -- the same trio /today uses, all RLS-scoped to their own leads.
  const [queue, leads, followUps] = await Promise.all([
    getMyDutyQueue(),
    getLeads({}),
    getFollowUps({ status: "pending" }),
  ]);

  return <StaffHome firstName={firstName} board={buildStaffHome({ dutyItems: queue.items, leads, followUps })} />;
}
