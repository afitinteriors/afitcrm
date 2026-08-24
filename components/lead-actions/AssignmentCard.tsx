import { Card } from "@/components/Card";
import { AssignmentSelect } from "@/components/lead-actions/AssignmentSelect";
import { getAssignableStaff, getProfileDisplayName } from "@/lib/staff";
import { getCurrentProfile } from "@/lib/auth";

export async function AssignmentCard({
  leadId,
  assignedToId,
}: {
  leadId: string;
  assignedToId: string | null;
}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const assigneeName = !assignedToId
    ? null
    : assignedToId === profile.id
      ? profile.displayName
      : await getProfileDisplayName(assignedToId);

  if (profile.role !== "admin") {
    return (
      <Card title="Assigned to">
        <p className="text-sm text-slate-900">{assigneeName || "Unassigned"}</p>
      </Card>
    );
  }

  const staff = await getAssignableStaff();

  return (
    <Card title="Assigned to">
      <p className="mb-3 text-sm text-slate-600">
        Current: <span className="font-medium text-slate-900">{assigneeName || "Unassigned"}</span>
      </p>
      <AssignmentSelect leadId={leadId} assignedToId={assignedToId} staff={staff} />
    </Card>
  );
}
