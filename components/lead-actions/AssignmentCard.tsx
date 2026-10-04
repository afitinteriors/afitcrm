import { Card } from "@/components/Card";
import { AssignmentSelect } from "@/components/lead-actions/AssignmentSelect";
import { getAssignableStaff, getProfileDisplayName } from "@/lib/staff";
import { getCurrentProfile } from "@/lib/auth";
import { getLeadAssignmentHistory } from "@/lib/assignments";
import { formatDateTime } from "@/lib/format";
import type { AssignmentHistoryEntry } from "@/lib/assignment-logic";

function historyLine(entry: AssignmentHistoryEntry): string {
  switch (entry.kind) {
    case "assigned":
      return `${entry.actorName} assigned to ${entry.toName}`;
    case "reassigned":
      return `${entry.actorName} reassigned ${entry.fromName} → ${entry.toName}`;
    case "assigned_unknown_previous":
      return `${entry.actorName} assigned to ${entry.toName} (earlier owner not recorded)`;
    case "created":
      return "Lead created";
  }
}

export async function AssignmentCard({
  leadId,
  assignedToId,
  createdAt,
}: {
  leadId: string;
  assignedToId: string | null;
  createdAt: string;
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
        <p className="text-sm text-foreground">{assigneeName || "Unassigned"}</p>
      </Card>
    );
  }

  const [staff, history] = await Promise.all([getAssignableStaff(), getLeadAssignmentHistory(leadId)]);

  return (
    <Card title="Assigned to">
      <p className="mb-3 text-sm text-muted-foreground">
        Current: <span className="font-medium text-foreground">{assigneeName || "Unassigned"}</span>
      </p>
      <AssignmentSelect leadId={leadId} assignedToId={assignedToId} staff={staff} />

      <div className="mt-4 border-t border-border pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignment history</h3>
        <ol className="mt-2 space-y-2">
          <li className="text-sm text-foreground">
            Lead created <span className="text-xs text-muted-foreground">· {formatDateTime(createdAt)}</span>
          </li>
          {history.map((entry, index) => (
            <li key={`${entry.kind}-${entry.at}-${index}`} className="text-sm text-foreground">
              {historyLine(entry)} <span className="text-xs text-muted-foreground">· {formatDateTime(entry.at)}</span>
            </li>
          ))}
        </ol>
        {history.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No assignment changes recorded since this lead was created.</p>}
      </div>
    </Card>
  );
}
