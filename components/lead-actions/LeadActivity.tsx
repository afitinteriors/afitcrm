import { Card } from "@/components/Card";
import { getCurrentProfile } from "@/lib/auth";
import { getLeadActivity } from "@/lib/audit-logs";
import { formatRelative, labelize } from "@/lib/format";
import type { AuditAction } from "@/lib/supabase/types";

const ACTIVITY_LABELS: Partial<Record<AuditAction, string>> = {
  lead_created: "Lead created",
  lead_viewed: "Viewed",
  lead_updated: "Details updated",
  lead_assigned: "Reassigned",
  follow_up_created: "Follow-up added",
  follow_up_completed: "Follow-up completed",
};

// Admin-only, same "hide, don't gate" convention as SidebarAdminNav --
// audit_logs_select_admin_only (RLS) is the real boundary, this is just
// convenience visibility. Reads the same audit_logs table the /audit-log
// page does, scoped to this one lead via getLeadActivity.
export async function LeadActivity({ leadId }: { leadId: string }) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return null;

  const events = await getLeadActivity(leadId);
  if (events.length === 0) return null;

  return (
    <div className="mt-6">
      <Card title="Activity">
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-3 text-sm">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
              <div className="min-w-0 flex-1">
                <p className="text-foreground">
                  <span className="font-medium">{event.actor?.display_name || "Someone"}</span>{" "}
                  {(ACTIVITY_LABELS[event.action] ?? labelize(event.action)).toLowerCase()}
                </p>
                <p className="text-xs text-muted-foreground">{formatRelative(event.created_at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
