import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { DutyList } from "@/components/dashboard/DutyList";
import type { DutyQueue, RecentLead, StalledPipelineLead, StaffWorkloadRow, UnassignedLead } from "@/lib/dashboard-brain";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";
import { LEAD_STATUS_LABELS } from "@/lib/constants";

const OVERDUE_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />;
const UNASSIGNED_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0" />;
const RISK_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.947-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007" />;
const NO_ACTION_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;

function UnassignedList({ items }: { items: UnassignedLead[] }) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">Every active lead is assigned.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((lead) => (
        <li key={lead.id}>
          <Link href={`/leads/${lead.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-secondary">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {LEAD_STATUS_LABELS[lead.status]} · Created {formatRelative(lead.created_at)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StalledPipelineList({ items }: { items: StalledPipelineLead[] }) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No quotation/negotiation lead is stalled.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((lead) => (
        <li key={lead.id}>
          <Link href={`/leads/${lead.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-secondary">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {LEAD_STATUS_LABELS[lead.status]} · {lead.assigned?.display_name || "Unassigned"} · no follow-up scheduled
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(lead.quotation_amount ?? lead.job_value)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StaffWorkloadTable({ rows }: { rows: StaffWorkloadRow[] }) {
  if (rows.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No staff accounts yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Staff</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Open Leads</th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.staffId}>
              <td className="px-4 py-2 font-medium text-foreground">{r.displayName || "—"}</td>
              <td className="px-4 py-2 text-muted-foreground">{r.openLeads}</td>
              <td className={`px-4 py-2 ${r.overdueFollowUps > 0 ? "font-semibold text-danger" : "text-muted-foreground"}`}>
                {r.overdueFollowUps}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentLeadsList({ items }: { items: RecentLead[] }) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No leads yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((lead) => (
        <li key={lead.id}>
          <Link href={`/leads/${lead.id}`} className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-secondary">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{lead.customer_name || "Unnamed lead"}</p>
              <p className="truncate text-xs text-muted-foreground">{LEAD_STATUS_LABELS[lead.status]}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(lead.created_at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Admin desktop + mobile home. A management/oversight surface, not a
// personal task list -- see docs/strategy/follow-up-brain/06 §9. Mobile
// intentionally shows only the counters + the single most urgent list,
// per the phase instruction that an admin mobile view must stay a
// deliberately limited utility, not the desktop dashboard compressed.
export function AdminHome({
  queue,
  unassigned,
  stalled,
  workload,
  recent,
}: {
  queue: DutyQueue;
  unassigned: UnassignedLead[];
  stalled: StalledPipelineLead[];
  workload: StaffWorkloadRow[];
  recent: RecentLead[];
}) {
  const overdueItems = queue.items.filter((i) => i.reasonKind === "overdue_follow_up" || i.reasonKind === "due_today_follow_up");
  const stalledValue = stalled.reduce((sum, l) => sum + (l.quotation_amount ?? l.job_value ?? 0), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Sales Operations</h1>
      <p className="mt-1 text-sm text-muted-foreground">Team-wide attention, exceptions and workload.</p>

      {/* ---------- Desktop ---------- */}
      <div className="mt-5 hidden lg:block">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Overdue (Team)" value={queue.counts.overdue} icon={OVERDUE_ICON} tone={queue.counts.overdue > 0 ? "danger" : "neutral"} />
          <StatCard label="Unassigned Leads" value={unassigned.length} icon={UNASSIGNED_ICON} tone={unassigned.length > 0 ? "warning" : "neutral"} />
          <StatCard label="No Follow-up" value={queue.counts.noFollowUp} icon={NO_ACTION_ICON} tone={queue.counts.noFollowUp > 0 ? "warning" : "neutral"} />
          <StatCard label="Pipeline at Risk" value={formatCurrency(stalledValue)} icon={RISK_ICON} tone={stalledValue > 0 ? "danger" : "neutral"} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Overdue Work (Team)</h2>
            </div>
            <DutyList items={overdueItems} emptyLabel="No overdue work anywhere." />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Unassigned Leads</h2>
            </div>
            <UnassignedList items={unassigned} />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Staff Workload</h2>
            </div>
            <StaffWorkloadTable rows={workload} />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Pipeline Attention (Quotation/Negotiation)</h2>
            </div>
            <StalledPipelineList items={stalled} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          </div>
          <RecentLeadsList items={recent} />
        </div>
      </div>

      {/* ---------- Mobile: deliberately limited utility view, not the desktop dashboard ---------- */}
      <div className="mt-5 space-y-4 lg:hidden">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Overdue (Team)" value={queue.counts.overdue} icon={OVERDUE_ICON} tone={queue.counts.overdue > 0 ? "danger" : "neutral"} />
          <StatCard label="Unassigned" value={unassigned.length} icon={UNASSIGNED_ICON} tone={unassigned.length > 0 ? "warning" : "neutral"} />
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Needs Intervention</h2>
          </div>
          <DutyList items={overdueItems.slice(0, 8)} emptyLabel="Nothing needs intervention right now." />
        </div>
        <Link href="/leads" className="block rounded-md border border-border bg-secondary px-4 py-3 text-center text-sm font-medium text-foreground hover:bg-muted">
          Open full Leads list →
        </Link>
      </div>
    </div>
  );
}
