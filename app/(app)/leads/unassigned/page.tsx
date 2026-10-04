import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getStaffWorkload, getUnassignedLeads } from "@/lib/assignments";
import { formatCurrency, formatDate } from "@/lib/format";
import { UnassignedLeadsView, type UnassignedRowView } from "@/components/assignments/UnassignedLeadsView";
import { isCreatedToday, isOlderThan24h, leadAgeHours, lowestWorkloadStaffId, summarizeUnassigned } from "@/lib/assignment-logic";

// Admin-only assignment queue. Staff get a real 404 (not just a hidden link),
// and the data functions also return nothing for non-admins.
export default async function UnassignedLeadsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const now = new Date();
  const [leads, workload] = await Promise.all([getUnassignedLeads(), getStaffWorkload()]);
  const summary = summarizeUnassigned(leads, now);

  const rows: UnassignedRowView[] = leads.map((lead) => {
    const hours = Math.floor(leadAgeHours(lead.created_at, now));
    const ageLabel = hours < 1 ? "Just now" : hours < 48 ? `${hours}h old` : `${Math.floor(hours / 24)} days old`;
    const value = lead.job_value ?? lead.quotation_amount;
    return {
      id: lead.id,
      customerName: lead.customer_name,
      source: lead.source,
      status: lead.status,
      createdLabel: formatDate(lead.created_at),
      ageLabel,
      olderThan24h: isOlderThan24h(lead.created_at, now),
      createdToday: isCreatedToday(lead.created_at, now),
      location: lead.location,
      projectType: lead.project_type,
      serviceRequired: lead.service_required,
      valueLabel: value !== null && value !== undefined ? formatCurrency(value) : null,
    };
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Unassigned Leads</h1>
      <p className="mt-1 text-sm text-muted-foreground">Leads with no owner yet. Assign them to staff; nothing changes until you confirm.</p>

      {leads.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-md">
          <Stat label="Unassigned" value={summary.total} />
          <Stat label="Older than 24h" value={summary.olderThan24h} tone={summary.olderThan24h > 0 ? "danger" : "neutral"} />
          <Stat label="Created today" value={summary.createdToday} />
        </div>
      )}

      <div className="mt-5">
        <UnassignedLeadsView rows={rows} staff={workload} recommendedStaffId={lowestWorkloadStaffId(workload)} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className={`text-lg font-bold ${tone === "danger" ? "text-danger" : "text-foreground"}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
