import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getAssignableStaff } from "@/lib/staff";
import { isFollowUpOverdue } from "@/lib/follow-up-status";
import { LEAD_STATUSES, FOLLOW_UP_TYPES, OPEN_LEAD_STATUSES, LEAD_SOURCE_LABELS } from "@/lib/constants";
import { businessDateOf, businessDayRangeToUtcBounds } from "@/lib/business-time";
import { resolveReportDateRange, type ReportDateFilterInput, type ReportDatePreset } from "@/lib/report-date-filters";
import type { LeadStatus, FollowUpType, FollowUpStatus } from "@/lib/supabase/types";

// Reports v2 (this file) adds a real reporting-period filter on top of the
// original v1 "snapshot of every current row" design (approved spec,
// 2026-08-30): every metric is still derived from current row state
// (leads.status, job_value, quotation_amount, etc.) rather than
// audit_logs or any assumed stage-transition history -- neither exists
// reliably in this schema (no won_at/lost_at). The period filter scopes
// *which leads/follow-ups count* by their real created_at timestamp (the
// one reliable per-row date this schema has, the same one the Leads
// list's own date filter and the Admin Dashboard's trend chart already
// key off), then reports each metric computed from THEIR CURRENT status --
// e.g. "Won this period" means "won leads that were created in this
// period", not "leads that transitioned to Won during this period" (this
// schema cannot tell you the latter).

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
  source: string | null;
  created_at: string;
};

type ReportFollowUp = {
  status: FollowUpStatus;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  type: FollowUpType;
  lead: { assigned_to_id: string | null } | null;
};

type Bounds = { startIso: string; endExclusiveIso: string };

// Same RLS-safe shape as getLeads()/getFollowUps() in lib/leads.ts and
// lib/follow-ups.ts: admin unrestricted, staff explicitly narrowed to their
// own assigned_to_id in addition to RLS. `bounds`, when given, scopes to
// leads created within the reporting period -- the same [gte, lt) pattern
// the Leads list's own date filter uses (lib/business-time.ts).
async function getReportLeads(bounds: Bounds | null): Promise<ReportLead[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase
    .from("leads")
    .select("id, status, job_value, quotation_amount, assigned_to_id, qualification_score, service_required, lost_reason, source, created_at")
    .is("merged_into_id", null);

  if (bounds) query = query.gte("created_at", bounds.startIso).lt("created_at", bounds.endExclusiveIso);
  if (profile.role === "staff") query = query.eq("assigned_to_id", profile.id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ReportLead[];
}

// follow_ups_select_admin_or_owner (RLS) already scopes by the linked
// lead's assigned_to_id, not follow_ups.assigned_to_id (which just records
// who created/actioned the follow-up, per the Follow-ups phase's own
// finding) -- no extra .eq() needed here, matching lib/follow-ups.ts's
// existing functions. `bounds` scopes to follow-ups created within the
// reporting period, same as leads above.
async function getReportFollowUps(bounds: Bounds | null): Promise<ReportFollowUp[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  let query = supabase.from("follow_ups").select("status, due_date, completed_at, created_at, type, lead:leads(assigned_to_id)");
  if (bounds) query = query.gte("created_at", bounds.startIso).lt("created_at", bounds.endExclusiveIso);

  const { data, error } = await query;
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
  averageWonValue: number | null;
  lostReasons: LostReasonCount[];
};

function computeWonLost(leads: ReportLead[]): WonLostReport {
  const won = leads.filter((l) => l.status === "won");
  const lost = leads.filter((l) => l.status === "lost");
  const decided = won.length + lost.length;
  const totalWonValue = won.reduce((sum, l) => sum + (l.job_value ?? 0), 0);

  const reasonCounts = new Map<string, number>();
  for (const lead of lost) {
    const reason = lead.lost_reason || "Unspecified";
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }

  return {
    wonCount: won.length,
    lostCount: lost.length,
    winRate: decided > 0 ? won.length / decided : null,
    totalWonValue,
    averageWonValue: won.length > 0 ? totalWonValue / won.length : null,
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

export type LeadSourceSlice = { source: string; label: string; count: number; percentage: number };

// Real leads.source values only (whatsapp/manual/meta_ads today -- see
// LEAD_SOURCES in lib/constants.ts for the full recognised set), computed
// from the same period-scoped `leads` array every other section here uses
// -- no second query.
function computeLeadSourceBreakdown(leads: ReportLead[]): LeadSourceSlice[] {
  const total = leads.length;
  if (total === 0) return [];

  const counts = new Map<string, number>();
  for (const lead of leads) {
    const key = lead.source ?? "other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({
      source,
      label: LEAD_SOURCE_LABELS[source] ?? source,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

export type TrendPoint = { date: string; new: number; contacted: number; qualified: number; quotation: number; won: number };

const TREND_MAX_POINTS = 120;

function shiftDay(day: string, deltaDays: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

// One point per business-day in [from, to], tallying the period-scoped
// `leads` by created_at day and CURRENT status (new/contacted/qualified/
// quotation/won -- the same 5-series legend the Admin Dashboard's own
// trend chart uses, for visual consistency; site_visit/negotiation/lost
// aren't in that legend so they're left out here too rather than silently
// added). Capped at TREND_MAX_POINTS so a very wide custom range degrades
// to "too many days to chart" instead of an unusably dense line.
function computeTrendByDay(leads: ReportLead[], from: string, to: string): TrendPoint[] {
  const days: string[] = [];
  let cur = from;
  while (cur <= to && days.length < TREND_MAX_POINTS) {
    days.push(cur);
    cur = shiftDay(cur, 1);
  }

  const byDay = new Map<string, TrendPoint>(days.map((d) => [d, { date: d, new: 0, contacted: 0, qualified: 0, quotation: 0, won: 0 }]));
  for (const lead of leads) {
    const day = businessDateOf(lead.created_at);
    const point = day ? byDay.get(day) : undefined;
    if (!point) continue;
    if (lead.status === "new" || lead.status === "contacted" || lead.status === "qualified" || lead.status === "quotation" || lead.status === "won") {
      point[lead.status] += 1;
    }
  }

  return Array.from(byDay.values());
}

export type PeriodComparison = { current: number; previous: number; changePct: number | null };

function compare(current: number, previous: number): PeriodComparison {
  return { current, previous, changePct: previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null };
}

export type ExecutiveSummary = {
  totalLeads: PeriodComparison;
  newLeadsCount: number;
  qualifiedCount: number;
  wonCount: PeriodComparison;
  wonValue: PeriodComparison;
  quotedCount: PeriodComparison;
  quotedValue: PeriodComparison;
  pipelineValue: number;
  averageWonValue: number | null;
  averageQuotationValue: number | null;
  overallWonRate: number | null;
};

// Pipeline value: sum of job_value (falling back to quotation_amount) for
// every OPEN-pipeline lead in the period -- the exact same "best known deal
// size" convention getStaffOverview() already uses for the Staff Dashboard.
function computePipelineValue(leads: ReportLead[]): number {
  return leads
    .filter((l) => OPEN_LEAD_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + (l.job_value ?? l.quotation_amount ?? 0), 0);
}

function computeExecutiveSummary(leads: ReportLead[], previousLeads: ReportLead[]): ExecutiveSummary {
  const won = leads.filter((l) => l.status === "won");
  const quoted = leads.filter((l) => l.quotation_amount !== null);
  const prevWon = previousLeads.filter((l) => l.status === "won");
  const prevQuoted = previousLeads.filter((l) => l.quotation_amount !== null);
  const nonInvalid = leads.filter((l) => l.status !== "invalid");

  const wonValue = won.reduce((sum, l) => sum + (l.job_value ?? 0), 0);
  const quotedValue = quoted.reduce((sum, l) => sum + (l.quotation_amount ?? 0), 0);

  return {
    totalLeads: compare(leads.length, previousLeads.length),
    newLeadsCount: leads.filter((l) => l.status === "new").length,
    qualifiedCount: leads.filter((l) => l.status === "qualified").length,
    wonCount: compare(won.length, prevWon.length),
    wonValue: compare(wonValue, prevWon.reduce((sum, l) => sum + (l.job_value ?? 0), 0)),
    quotedCount: compare(quoted.length, prevQuoted.length),
    quotedValue: compare(quotedValue, prevQuoted.reduce((sum, l) => sum + (l.quotation_amount ?? 0), 0)),
    pipelineValue: computePipelineValue(leads),
    averageWonValue: won.length > 0 ? wonValue / won.length : null,
    averageQuotationValue: quoted.length > 0 ? quotedValue / quoted.length : null,
    overallWonRate: nonInvalid.length > 0 ? won.length / nonInvalid.length : null,
  };
}

export type ReportPeriod = { preset: ReportDatePreset; from: string; to: string };

export type ReportsData = {
  period: ReportPeriod;
  executiveSummary: ExecutiveSummary;
  pipelineDistribution: PipelineDistribution;
  wonLost: WonLostReport;
  quotationPerformance: QuotationPerformance;
  salesPerformance: SalesPerformance;
  conversion: ConversionReport;
  staffPerformance: StaffPerformanceRow[];
  followUpPerformance: FollowUpPerformance;
  leadSourceBreakdown: LeadSourceSlice[];
  trend: TrendPoint[];
};

function emptyReportsData(period: ReportPeriod): ReportsData {
  return {
    period,
    executiveSummary: {
      totalLeads: { current: 0, previous: 0, changePct: null },
      newLeadsCount: 0,
      qualifiedCount: 0,
      wonCount: { current: 0, previous: 0, changePct: null },
      wonValue: { current: 0, previous: 0, changePct: null },
      quotedCount: { current: 0, previous: 0, changePct: null },
      quotedValue: { current: 0, previous: 0, changePct: null },
      pipelineValue: 0,
      averageWonValue: null,
      averageQuotationValue: null,
      overallWonRate: null,
    },
    pipelineDistribution: { statusBreakdown: EMPTY_STATUS_BREAKDOWN, totalLeads: 0 },
    wonLost: { wonCount: 0, lostCount: 0, winRate: null, totalWonValue: 0, averageWonValue: null, lostReasons: [] },
    quotationPerformance: { quotedCount: 0, totalQuotedValue: 0, averageQuotationAmount: null, quoteToWonRate: null },
    salesPerformance: { totalWonValue: 0, wonCount: 0, byStaff: [], byService: [] },
    conversion: { overallWonRate: null, statusBreakdown: EMPTY_STATUS_BREAKDOWN, totalLeads: 0 },
    staffPerformance: [],
    followUpPerformance: { completionRate: null, overdueCount: 0, byType: [], avgTimeToCompleteHours: null },
    leadSourceBreakdown: [],
    trend: [],
  };
}

// One combined fetch (leads + follow_ups, each already RLS-scoped and
// period-scoped) feeding every report section, rather than repeating the
// same admin-vs-staff scoping and date filter once per section. A second,
// equal-length "previous period" leads fetch backs the executive summary's
// period-over-period deltas -- the only section that needs it, so it's
// kept separate rather than widening the main fetch.
export async function getReportsData(filters: ReportDateFilterInput = {}): Promise<ReportsData> {
  const resolved = resolveReportDateRange(filters);
  const period: ReportPeriod = resolved;
  const bounds = businessDayRangeToUtcBounds(resolved.from, resolved.to);

  const profile = await getCurrentProfile();
  if (!profile || !bounds) return emptyReportsData(period);

  const spanDays = daysBetween(resolved.from, resolved.to) + 1;
  const previousTo = shiftDay(resolved.from, -1);
  const previousFrom = shiftDay(previousTo, -(spanDays - 1));
  const previousBounds = businessDayRangeToUtcBounds(previousFrom, previousTo);

  const [leads, followUps, previousLeads] = await Promise.all([
    getReportLeads(bounds),
    getReportFollowUps(bounds),
    previousBounds ? getReportLeads(previousBounds) : Promise.resolve([]),
  ]);

  return {
    period,
    executiveSummary: computeExecutiveSummary(leads, previousLeads),
    pipelineDistribution: computePipelineDistribution(leads),
    wonLost: computeWonLost(leads),
    quotationPerformance: computeQuotationPerformance(leads),
    salesPerformance: await computeSalesPerformance(leads, profile.role === "admin"),
    conversion: computeConversion(leads),
    staffPerformance: await computeStaffPerformance(leads, followUps, profile),
    followUpPerformance: computeFollowUpPerformance(followUps),
    leadSourceBreakdown: computeLeadSourceBreakdown(leads),
    trend: computeTrendByDay(leads, resolved.from, resolved.to),
  };
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86400000);
}
