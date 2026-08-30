import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getAssignableStaff } from "@/lib/staff";
import { isFollowUpOverdue } from "@/lib/follow-up-status";
import { LEAD_STATUSES, FOLLOW_UP_TYPES } from "@/lib/constants";
import type { LeadStatus, FollowUpType, FollowUpStatus } from "@/lib/supabase/types";

// Reports v1 is snapshot-only (approved spec, 2026-08-30): every metric here
// is derived from current row state (leads.status, job_value,
// quotation_amount, etc.), never from audit_logs or any assumed
// stage-transition history -- neither exists reliably in this schema. See
// CLAUDE.md's Reports section for why (no won_at/lost_at, and audit_logs
// RLS is admin-only so it could never back a staff-facing report anyway).

const EMPTY_STATUS_BREAKDOWN: Record<LeadStatus, number> = Object.fromEntries(
  LEAD_STATUSES.map((status) => [status, 0]),
) as Record<LeadStatus, number>;

type ReportLead = {
  id: string;
  status: LeadStatus;
  job_value: number | null;
  quotation_amount: number | null;
  assigned_to_id: string | null;
  qualification_score: number | null;
  service_required: string | null;
  lost_reason: string | null;
};

type ReportFollowUp = {
  status: FollowUpStatus;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  type: FollowUpType;
  lead: { assigned_to_id: string | null } | null;
};

// Same RLS-safe shape as getLeads()/getFollowUps() in lib/leads.ts and
// lib/follow-ups.ts: admin unrestricted, staff explicitly narrowed to their
// own assigned_to_id in addition to RLS. One shared fetch per request (this
// page needs all seven reports at once) rather than seven independent
// queries repeating the same scoping.
async function getReportLeads(): Promise<ReportLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, status, job_value, quotation_amount, assigned_to_id, qualification_score, service_required, lost_reason");

  if (profile.role === "staff") {
    query = query.eq("assigned_to_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReportLead[];
}

// follow_ups_select_admin_or_owner (RLS) already scopes by the linked
// lead's assigned_to_id, not follow_ups.assigned_to_id (which just records
// who created/actioned the follow-up, per the Follow-ups phase's own
// finding) -- no extra .eq() needed here, matching lib/follow-ups.ts's
// existing functions. The `lead:leads(assigned_to_id)` embed is what lets
// Staff Performance below group follow-ups by the *lead's* owner, the same
// unit of ownership every other view in this app uses.
async function getReportFollowUps(): Promise<ReportFollowUp[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("status, due_date, completed_at, created_at, type, lead:leads(assigned_to_id)");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReportFollowUp[];
}

export type PipelineDistribution = {
  statusBreakdown: Record<LeadStatus, number>;
  totalLeads: number;
};

function computePipelineDistribution(leads: ReportLead[]): PipelineDistribution {
  const statusBreakdown = { ...EMPTY_STATUS_BREAKDOWN };
  for (const lead of leads) statusBreakdown[lead.status] += 1;
  return { statusBreakdown, totalLeads: leads.length };
}

export type LostReasonCount = { reason: string; count: number };

export type WonLostReport = {
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  totalWonValue: number;
  lostReasons: LostReasonCount[];
};

function computeWonLost(leads: ReportLead[]): WonLostReport {
  const won = leads.filter((l) => l.status === "won");
  const lost = leads.filter((l) => l.status === "lost");
  const decided = won.length + lost.length;

  const reasonCounts = new Map<string, number>();
  for (const lead of lost) {
    const reason = lead.lost_reason || "Unspecified";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  return {
    wonCount: won.length,
    lostCount: lost.length,
    winRate: decided > 0 ? won.length / decided : null,
    totalWonValue: won.reduce((sum, l) => sum + (l.job_value ?? 0), 0),
    lostReasons: Array.from(reasonCounts, ([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}

export type QuotationPerformance = {
  quotedCount: number;
  totalQuotedValue: number;
  averageQuotationAmount: number | null;
  quoteToWonRate: number | null;
};

function computeQuotationPerformance(leads: ReportLead[]): QuotationPerformance {
  const quoted = leads.filter((l) => l.quotation_amount !== null);
  const totalQuotedValue = quoted.reduce((sum, l) => sum + (l.quotation_amount ?? 0), 0);
  const wonAmongQuoted = quoted.filter((l) => l.status === "won").length;

  return {
    quotedCount: quoted.length,
    totalQuotedValue,
    averageQuotationAmount: quoted.length > 0 ? totalQuotedValue / quoted.length : null,
    quoteToWonRate: quoted.length > 0 ? wonAmongQuoted / quoted.length : null,
  };
}

export type SalesByStaff = { staffId: string; displayName: string; wonCount: number; wonValue: number };
export type SalesByService = { service: string; wonCount: number; wonValue: number };

export type SalesPerformance = {
  totalWonValue: number;
  wonCount: number;
  byStaff: SalesByStaff[];
  byService: SalesByService[];
};

// byStaff is only ever populated for an admin caller. For staff, `leads` is
// already RLS-narrowed to their own rows, so a staff/service breakdown
// across "all staff" would just be one row repeating the totals above --
// not a new leak, but not a useful report either, so it's left empty
// rather than rendered as if it meant something.
async function computeSalesPerformance(leads: ReportLead[], isAdmin: boolean): Promise<SalesPerformance> {
  const won = leads.filter((l) => l.status === "won");
  const totalWonValue = won.reduce((sum, l) => sum + (l.job_value ?? 0), 0);

  let byStaff: SalesByStaff[] = [];
  if (isAdmin) {
    const staffOptions = await getAssignableStaff();
    byStaff = staffOptions
      .map((staff) => {
        const staffWon = won.filter((l) => l.assigned_to_id === staff.id);
        return {
          staffId: staff.id,
          displayName: staff.display_name || "Unnamed",
          wonCount: staffWon.length,
          wonValue: staffWon.reduce((sum, l) => sum + (l.job_value ?? 0), 0),
        };
      })
      .filter((row) => row.wonCount > 0);
  }

  const serviceCounts = new Map<string, { wonCount: number; wonValue: number }>();
  for (const lead of won) {
    const service = lead.service_required || "Unspecified";
    const existing = serviceCounts.get(service) ?? { wonCount: 0, wonValue: 0 };
    existing.wonCount += 1;
    existing.wonValue += lead.job_value ?? 0;
    serviceCounts.set(service, existing);
  }
  const byService = Array.from(serviceCounts, ([service, v]) => ({ service, ...v })).sort(
    (a, b) => b.wonValue - a.wonValue,
  );

  return { totalWonValue, wonCount: won.length, byStaff, byService };
}

export type ConversionReport = {
  // Denominator is every non-"invalid" lead (open + won + lost), matching
  // PIPELINE_STATUSES' own exclusion of "invalid" as a data-quality
  // disposition rather than a funnel stage -- deliberately different from
  // WonLostReport.winRate (won / (won+lost), i.e. of *decided* leads only).
  // This is "what fraction of everything that came in has converted",
  // WonLostReport is "of the ones we've closed, what fraction did we win".
  overallWonRate: number | null;
  statusBreakdown: Record<LeadStatus, number>;
  totalLeads: number;
};

function computeConversion(leads: ReportLead[]): ConversionReport {
  const nonInvalid = leads.filter((l) => l.status !== "invalid");
  const won = nonInvalid.filter((l) => l.status === "won").length;
  const { statusBreakdown, totalLeads } = computePipelineDistribution(leads);

  return {
    overallWonRate: nonInvalid.length > 0 ? won / nonInvalid.length : null,
    statusBreakdown,
    totalLeads,
  };
}

export type StaffPerformanceRow = {
  staffId: string;
  displayName: string;
  leadsAssigned: number;
  wonCount: number;
  wonValue: number;
  followUpsCompleted: number;
  followUpsOverdue: number;
  avgQualificationScore: number | null;
};

function computeStaffRow(staffId: string, displayName: string, leads: ReportLead[], followUps: ReportFollowUp[]): StaffPerformanceRow {
  const staffLeads = leads.filter((l) => l.assigned_to_id === staffId);
  const won = staffLeads.filter((l) => l.status === "won");
  const staffFollowUps = followUps.filter((f) => f.lead?.assigned_to_id === staffId);
  const scores = staffLeads.map((l) => l.qualification_score).filter((s): s is number => s !== null);

  return {
    staffId,
    displayName,
    leadsAssigned: staffLeads.length,
    wonCount: won.length,
    wonValue: won.reduce((sum, l) => sum + (l.job_value ?? 0), 0),
    followUpsCompleted: staffFollowUps.filter((f) => f.status === "completed").length,
    followUpsOverdue: staffFollowUps.filter((f) => isFollowUpOverdue(f)).length,
    avgQualificationScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}

// Admin: one row per real staff member (getAssignableStaff(), the same
// admin-only roster the Follow-ups workspace's assignee filter already
// uses), each row computed by filtering the already-admin-unrestricted
// `leads`/`followUps` client-side -- never a raw GROUP BY that could return
// another staff's aggregate without going through this per-id filter.
// Staff: `leads`/`followUps` are already RLS-narrowed (plus getReportLeads'
// own explicit .eq()) to this caller's own rows before this function ever
// runs, so their one row can only ever be their own data, structurally.
async function computeStaffPerformance(
  leads: ReportLead[],
  followUps: ReportFollowUp[],
  profile: { id: string; role: "admin" | "staff"; displayName: string | null },
): Promise<StaffPerformanceRow[]> {
  if (profile.role === "staff") {
    return [computeStaffRow(profile.id, profile.displayName || "Me", leads, followUps)];
  }

  const staffOptions = await getAssignableStaff();
  return staffOptions.map((staff) => computeStaffRow(staff.id, staff.display_name || "Unnamed", leads, followUps));
}

export type FollowUpPerformance = {
  completionRate: number | null;
  overdueCount: number;
  byType: { type: FollowUpType; count: number }[];
  avgTimeToCompleteHours: number | null;
};

function computeFollowUpPerformance(followUps: ReportFollowUp[]): FollowUpPerformance {
  const total = followUps.length;
  const completed = followUps.filter((f) => f.status === "completed");
  const overdueCount = followUps.filter((f) => isFollowUpOverdue(f)).length;
  const byType = FOLLOW_UP_TYPES.map((type) => ({ type, count: followUps.filter((f) => f.type === type).length }));

  const durationsMs = completed
    .filter((f) => f.completed_at !== null)
    .map((f) => new Date(f.completed_at as string).getTime() - new Date(f.created_at).getTime());
  const avgTimeToCompleteHours =
    durationsMs.length > 0 ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / (1000 * 60 * 60) : null;

  return {
    completionRate: total > 0 ? completed.length / total : null,
    overdueCount,
    byType,
    avgTimeToCompleteHours,
  };
}

export type ReportsData = {
  pipelineDistribution: PipelineDistribution;
  wonLost: WonLostReport;
  quotationPerformance: QuotationPerformance;
  salesPerformance: SalesPerformance;
  conversion: ConversionReport;
  staffPerformance: StaffPerformanceRow[];
  followUpPerformance: FollowUpPerformance;
};

const EMPTY_REPORTS_DATA: ReportsData = {
  pipelineDistribution: { statusBreakdown: EMPTY_STATUS_BREAKDOWN, totalLeads: 0 },
  wonLost: { wonCount: 0, lostCount: 0, winRate: null, totalWonValue: 0, lostReasons: [] },
  quotationPerformance: { quotedCount: 0, totalQuotedValue: 0, averageQuotationAmount: null, quoteToWonRate: null },
  salesPerformance: { totalWonValue: 0, wonCount: 0, byStaff: [], byService: [] },
  conversion: { overallWonRate: null, statusBreakdown: EMPTY_STATUS_BREAKDOWN, totalLeads: 0 },
  staffPerformance: [],
  followUpPerformance: { completionRate: null, overdueCount: 0, byType: [], avgTimeToCompleteHours: null },
};

// One combined fetch (leads + follow_ups, each already RLS-scoped) feeding
// all seven reports, rather than seven independent queries repeating the
// same admin-vs-staff scoping seven times over for one page render.
export async function getReportsData(): Promise<ReportsData> {
  const profile = await getCurrentProfile();
  if (!profile) return EMPTY_REPORTS_DATA;

  const [leads, followUps] = await Promise.all([getReportLeads(), getReportFollowUps()]);

  return {
    pipelineDistribution: computePipelineDistribution(leads),
    wonLost: computeWonLost(leads),
    quotationPerformance: computeQuotationPerformance(leads),
    salesPerformance: await computeSalesPerformance(leads, profile.role === "admin"),
    conversion: computeConversion(leads),
    staffPerformance: await computeStaffPerformance(leads, followUps, profile),
    followUpPerformance: computeFollowUpPerformance(followUps),
  };
}
