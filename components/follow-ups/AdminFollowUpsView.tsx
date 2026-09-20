import { StatCard } from "@/components/StatCard";
import { DutyList } from "@/components/dashboard/DutyList";
import { UnassignedLeadsList } from "@/components/dashboard/UnassignedLeadsList";
import { StalledPipelineList } from "@/components/dashboard/StalledPipelineList";
import { FollowUpsFilterBar } from "@/components/follow-ups/FollowUpsFilterBar";
import { FollowUpsSection } from "@/components/follow-ups/FollowUpsSection";
import { FollowUpListItem } from "@/components/follow-ups/FollowUpListItem";
import type { DutyQueue, StalledPipelineLead, UnassignedLead } from "@/lib/dashboard-brain";
import type { FollowUpGroups } from "@/lib/follow-up-status";
import { excludeLeadIds } from "@/lib/follow-up-queues";
import type { FollowUpListItem as FollowUpListItemData } from "@/lib/follow-ups";
import type { StaffOption } from "@/lib/staff";
import { formatCurrency } from "@/lib/format";

const OVERDUE_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />;
const UNASSIGNED_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />;
const NO_ACTION_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
const RISK_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.947-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007" />;

// Admin's operational Follow-ups workspace -- team-wide, not a personal
// task list (see StaffFollowUpsView for that). Every section below is
// mutually exclusive by construction, so the same lead is never listed
// twice (docs/strategy/follow-up-brain/04 + the phase's own "no duplicate
// across sections" requirement):
//
//   Unassigned Leads         -- assigned_to_id IS NULL, regardless of any
//                               other signal (the actionable fix is
//                               "assign it", which supersedes everything
//                               else that lead might also be missing)
//   Unanswered Conversations -- has an assignee, conversation unanswered
//   Leads Without a Follow-up -- has an assignee, no pending follow-up
//   Overdue/Today/Upcoming    -- literal follow_ups rows (existing model,
//                               unchanged) -- structurally can never
//                               overlap with the three lists above, since
//                               those are all leads with NO follow_ups row
export function AdminFollowUpsView({
  queue,
  groups,
  unassigned,
  stalled,
  status,
  type,
  assignedTo,
  staffOptions,
}: {
  queue: DutyQueue;
  groups: FollowUpGroups<FollowUpListItemData>;
  unassigned: UnassignedLead[];
  stalled: StalledPipelineLead[];
  status: string;
  type: string;
  assignedTo: string;
  staffOptions: StaffOption[];
}) {
  const unassignedIds = new Set(unassigned.map((l) => l.id));
  const isAlreadyUnassigned = (leadId: string | null) => leadId !== null && unassignedIds.has(leadId);

  const unansweredAssigned = queue.items.filter(
    (i) => i.reasonKind === "unanswered_conversation" && !isAlreadyUnassigned(i.leadId),
  );
  const noFollowUpAssigned = queue.items.filter(
    (i) => (i.reasonKind === "uncontacted_lead" || i.reasonKind === "no_follow_up") && !isAlreadyUnassigned(i.leadId),
  );
  // Pipeline Attention yields to every lead already listed above (one lead,
  // one queue): Unassigned, Unanswered, and Leads Without a Follow-up.
  const claimedLeadIds = new Set<string>(unassigned.map((l) => l.id));
  for (const i of [...unansweredAssigned, ...noFollowUpAssigned]) if (i.leadId) claimedLeadIds.add(i.leadId);
  const stalledOnly = excludeLeadIds(stalled, claimedLeadIds);
  const stalledValue = stalledOnly.reduce((sum, l) => sum + (l.quotation_amount ?? l.job_value ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Follow-ups</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every scheduled follow-up across your team, plus what has none yet.</p>

      {/* ---------- Desktop ---------- */}
      <div className="hidden lg:block">
        <div className="mt-4 grid grid-cols-4 gap-3">
          <StatCard label="Overdue (Team)" value={groups.overdue.length} icon={OVERDUE_ICON} tone={groups.overdue.length > 0 ? "danger" : "neutral"} />
          <StatCard label="Unassigned Leads" value={unassigned.length} icon={UNASSIGNED_ICON} tone={unassigned.length > 0 ? "warning" : "neutral"} />
          <StatCard label="No Follow-up" value={noFollowUpAssigned.length} icon={NO_ACTION_ICON} tone={noFollowUpAssigned.length > 0 ? "warning" : "neutral"} />
          <StatCard label="Pipeline at Risk" value={formatCurrency(stalledValue)} icon={RISK_ICON} tone={stalledValue > 0 ? "danger" : "neutral"} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Unassigned Leads</h2>
            </div>
            <UnassignedLeadsList items={unassigned} />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Unanswered Conversations</h2>
            </div>
            <DutyList items={unansweredAssigned} emptyLabel="No unanswered conversations." />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Leads Without a Follow-up</h2>
            </div>
            <DutyList items={noFollowUpAssigned} emptyLabel="Every assigned lead has a next step." />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Pipeline Attention (Quotation/Negotiation)</h2>
            </div>
            <StalledPipelineList items={stalledOnly} />
          </div>
        </div>

        <div className="mt-4">
          <FollowUpsFilterBar status={status} type={type} assignedTo={assignedTo} staffOptions={staffOptions} />
        </div>

        <div className="mt-4">
          <FollowUpsSection title="Overdue" items={groups.overdue} showAssignee emptyLabel="Nothing overdue." />
          <FollowUpsSection title="Today" items={groups.today} showAssignee emptyLabel="Nothing due today." />
          <FollowUpsSection title="Upcoming" items={groups.upcoming} showAssignee emptyLabel="Nothing scheduled." />

          {groups.completed.length > 0 && (
            <details className="mt-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Completed ({groups.completed.length})
              </summary>
              <div className="mt-2 space-y-2">
                {groups.completed.map((item) => (
                  <FollowUpListItem key={item.id} followUp={item} showAssignee />
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ---------- Mobile: deliberately limited utility view, not the desktop dashboard ---------- */}
      <div className="mt-4 space-y-4 lg:hidden">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Overdue (Team)" value={groups.overdue.length} icon={OVERDUE_ICON} tone={groups.overdue.length > 0 ? "danger" : "neutral"} />
          <StatCard label="Unassigned" value={unassigned.length} icon={UNASSIGNED_ICON} tone={unassigned.length > 0 ? "warning" : "neutral"} />
        </div>
        <FollowUpsSection title="Overdue (Team)" items={groups.overdue} showAssignee emptyLabel="Nothing overdue." />

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Unassigned Leads</h2>
          </div>
          <UnassignedLeadsList items={unassigned.slice(0, 8)} />
        </div>
      </div>
    </div>
  );
}
