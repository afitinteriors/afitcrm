import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportsData } from "@/lib/reports";
import { LEAD_STATUS_LABELS, FOLLOW_UP_TYPE_LABELS, PIPELINE_STATUSES } from "@/lib/constants";
import { formatDate } from "@/lib/format";

// PDF/CSV export for the Reports page. Deliberately client-side (this file
// has no server-only import) so the export renders from the exact same
// ReportsData object already on screen -- no second fetch, no risk of the
// PDF/CSV disagreeing with what the page shows.
//
// jsPDF's built-in fonts (Helvetica/Times/Courier) don't include the ₹
// glyph -- rendering it prints a blank box, not a rupee sign. Rather than
// embed a custom Unicode font just for one symbol, currency in the PDF/CSV
// uses "Rs." with the same en-IN digit grouping formatCurrency() uses
// on-screen; the on-screen ₹ display is untouched.
function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function pct(value: number | null): string {
  return value === null ? "-" : `${Math.round(value * 100)}%`;
}

function change(current: number, previous: number, changePct: number | null): string {
  if (changePct === null) return "n/a (no prior period data)";
  const sign = changePct >= 0 ? "+" : "";
  return `${sign}${changePct}% (was ${previous})`;
}

export type ReportMeta = {
  companyName: string;
  reportTitle: string;
  generatedAt: Date;
  generatedBy: string;
};

const MARGIN = 40;

function sectionHeading(doc: jsPDF, text: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text(text, MARGIN, y);
  doc.setTextColor(20, 20, 20);
  return y + 16;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 50) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function lastTableEndY(doc: jsPDF, fallback: number): number {
  const withTable = doc as unknown as { lastAutoTable?: { finalY: number } };
  return withTable.lastAutoTable ? withTable.lastAutoTable.finalY + 18 : fallback;
}

// Builds the full report as a jsPDF document -- a real corporate-report
// layout (title block, executive summary, then one section per report
// area, page-broken automatically by autoTable, footer with page numbers
// added last across every page) rather than a screenshot of the page.
// Every value here is read from `data`, the same ReportsData the Reports
// page itself renders -- nothing here re-derives or re-fetches anything.
export function buildReportsPdf(data: ReportsData, meta: ReportMeta): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Title block ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(22, 101, 52);
  doc.text(meta.companyName, MARGIN, 50);
  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text(meta.reportTitle, MARGIN, 70);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`Reporting period: ${formatDate(data.period.from)} - ${formatDate(data.period.to)}`, MARGIN, 90);
  doc.text(`Generated: ${meta.generatedAt.toLocaleString("en-IN")} by ${meta.generatedBy}`, MARGIN, 104);
  doc.setDrawColor(210, 210, 210);
  doc.line(MARGIN, 114, pageWidth - MARGIN, 114);

  let y = 140;
  const s = data.executiveSummary;

  // --- Executive Summary ---
  y = sectionHeading(doc, "Executive Summary", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Metric", "Value", "Change vs Prior Period"]],
    body: [
      ["Total Leads", String(s.totalLeads.current), change(s.totalLeads.current, s.totalLeads.previous, s.totalLeads.changePct)],
      ["New Leads", String(s.newLeadsCount), "-"],
      ["Qualified Leads", String(s.qualifiedCount), "-"],
      ["Won Deals", String(s.wonCount.current), change(s.wonCount.current, s.wonCount.previous, s.wonCount.changePct)],
      ["Won Value", money(s.wonValue.current), change(s.wonValue.current, s.wonValue.previous, s.wonValue.changePct)],
      ["Quoted Deals", String(s.quotedCount.current), change(s.quotedCount.current, s.quotedCount.previous, s.quotedCount.changePct)],
      ["Quoted Value", money(s.quotedValue.current), change(s.quotedValue.current, s.quotedValue.previous, s.quotedValue.changePct)],
      ["Pipeline Value (open deals)", money(s.pipelineValue), "-"],
      ["Average Deal Value", s.averageWonValue !== null ? money(s.averageWonValue) : "-", "-"],
      ["Average Quotation Value", s.averageQuotationValue !== null ? money(s.averageQuotationValue) : "-", "-"],
      ["Overall Win Rate", pct(s.overallWonRate), "-"],
    ],
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    theme: "grid",
  });
  y = lastTableEndY(doc, y + 100);

  // --- Pipeline Distribution ---
  y = ensureSpace(doc, y, 120);
  y = sectionHeading(doc, "Lead Pipeline Distribution", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Stage", "Leads", "% of Total"]],
    body: PIPELINE_STATUSES.filter((st) => data.pipelineDistribution.statusBreakdown[st] > 0).map((st) => {
      const count = data.pipelineDistribution.statusBreakdown[st];
      const totalPct = data.pipelineDistribution.totalLeads > 0 ? Math.round((count / data.pipelineDistribution.totalLeads) * 100) : 0;
      return [LEAD_STATUS_LABELS[st], String(count), `${totalPct}%`];
    }),
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    theme: "grid",
  });
  y = lastTableEndY(doc, y + 60);

  // --- Won / Lost ---
  y = ensureSpace(doc, y, 120);
  y = sectionHeading(doc, "Won / Lost Analysis", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Metric", "Value"]],
    body: [
      ["Won", String(data.wonLost.wonCount)],
      ["Lost", String(data.wonLost.lostCount)],
      ["Win Rate (of decided leads)", pct(data.wonLost.winRate)],
      ["Total Won Value", money(data.wonLost.totalWonValue)],
      ["Average Won Value", data.wonLost.averageWonValue !== null ? money(data.wonLost.averageWonValue) : "-"],
    ],
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    theme: "grid",
  });
  y = lastTableEndY(doc, y + 60);

  if (data.wonLost.lostReasons.length > 0) {
    y = ensureSpace(doc, y, 100);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Lost Reason", "Count"]],
      body: data.wonLost.lostReasons.map((r) => [r.reason, String(r.count)]),
      styles: { fontSize: 9.5, cellPadding: 5 },
      headStyles: { fillColor: [100, 100, 100], textColor: 255 },
      theme: "grid",
    });
    y = lastTableEndY(doc, y + 60);
  }

  // --- Quotation Performance ---
  y = ensureSpace(doc, y, 120);
  y = sectionHeading(doc, "Quotation Performance", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Metric", "Value"]],
    body: [
      ["Quoted Deals", String(data.quotationPerformance.quotedCount)],
      ["Total Quoted Value", money(data.quotationPerformance.totalQuotedValue)],
      ["Average Quotation Amount", data.quotationPerformance.averageQuotationAmount !== null ? money(data.quotationPerformance.averageQuotationAmount) : "-"],
      ["Quote -> Won Rate", pct(data.quotationPerformance.quoteToWonRate)],
    ],
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    theme: "grid",
  });
  y = lastTableEndY(doc, y + 80);

  // --- Sales Performance ---
  if (data.salesPerformance.byStaff.length > 0) {
    y = ensureSpace(doc, y, 120);
    y = sectionHeading(doc, "Sales Performance by Staff", y);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Staff", "Won Deals", "Won Value"]],
      body: data.salesPerformance.byStaff.map((r) => [r.displayName, String(r.wonCount), money(r.wonValue)]),
      styles: { fontSize: 9.5, cellPadding: 5 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      theme: "grid",
    });
    y = lastTableEndY(doc, y + 60);
  }

  if (data.salesPerformance.byService.length > 0) {
    y = ensureSpace(doc, y, 120);
    y = sectionHeading(doc, "Sales Performance by Service", y);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Service", "Won Deals", "Won Value"]],
      body: data.salesPerformance.byService.map((r) => [r.service, String(r.wonCount), money(r.wonValue)]),
      styles: { fontSize: 9.5, cellPadding: 5 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      theme: "grid",
    });
    y = lastTableEndY(doc, y + 60);
  }

  // --- Staff Performance ---
  if (data.staffPerformance.length > 0) {
    y = ensureSpace(doc, y, 140);
    y = sectionHeading(doc, "Staff Performance", y);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Staff", "Leads", "Won", "Won Value", "Follow-ups Done", "Overdue", "Avg Qualification"]],
      body: data.staffPerformance.map((r) => [
        r.displayName,
        String(r.leadsAssigned),
        String(r.wonCount),
        money(r.wonValue),
        String(r.followUpsCompleted),
        String(r.followUpsOverdue),
        r.avgQualificationScore !== null ? String(Math.round(r.avgQualificationScore)) : "-",
      ]),
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      theme: "grid",
    });
    y = lastTableEndY(doc, y + 80);
  }

  // --- Follow-up Performance ---
  y = ensureSpace(doc, y, 140);
  y = sectionHeading(doc, "Follow-up / Activity Performance", y);
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Metric", "Value"]],
    body: [
      ["Completion Rate", pct(data.followUpPerformance.completionRate)],
      ["Overdue", String(data.followUpPerformance.overdueCount)],
      [
        "Avg Time to Complete",
        data.followUpPerformance.avgTimeToCompleteHours !== null ? `${data.followUpPerformance.avgTimeToCompleteHours.toFixed(1)} hrs` : "-",
      ],
    ],
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255 },
    theme: "grid",
  });
  y = lastTableEndY(doc, y + 60);

  if (data.followUpPerformance.byType.some((t) => t.count > 0)) {
    y = ensureSpace(doc, y, 120);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Follow-up Type", "Count"]],
      body: data.followUpPerformance.byType.filter((t) => t.count > 0).map((t) => [FOLLOW_UP_TYPE_LABELS[t.type], String(t.count)]),
      styles: { fontSize: 9.5, cellPadding: 5 },
      headStyles: { fillColor: [100, 100, 100], textColor: 255 },
      theme: "grid",
    });
    y = lastTableEndY(doc, y + 60);
  }

  // --- Lead Source ---
  if (data.leadSourceBreakdown.length > 0) {
    y = ensureSpace(doc, y, 120);
    y = sectionHeading(doc, "Lead Source / Channel Analysis", y);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Source", "Leads", "% of Total"]],
      body: data.leadSourceBreakdown.map((r) => [r.label, String(r.count), `${r.percentage}%`]),
      styles: { fontSize: 9.5, cellPadding: 5 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      theme: "grid",
    });
    y = lastTableEndY(doc, y + 60);
  }

  // --- Trend (table form -- a chart can't render reliably in jsPDF; this
  // is the exact same data the page's line chart plots) ---
  if (data.trend.length > 0) {
    y = ensureSpace(doc, y, 120);
    y = sectionHeading(doc, "Lead Volume Trend (by day)", y);
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [["Date", "New", "Contacted", "Qualified", "Quotation", "Won"]],
      body: data.trend.map((t) => [formatDate(t.date), String(t.new), String(t.contacted), String(t.qualified), String(t.quotation), String(t.won)]),
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      theme: "grid",
    });
  }

  // --- Footer: page numbers on every page ---
  // internal.pages is 1-indexed with an unused slot at index 0, so its
  // length minus one is the real page count (getNumberOfPages() isn't in
  // this jsPDF version's type declarations, though pages is).
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const height = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(meta.companyName, MARGIN, height - 24);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN, height - 24, { align: "right" });
  }

  return doc;
}

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function csvRows(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

// Consolidated CSV of the report's tabular sections -- one practical file
// covering Executive Summary, Pipeline, Staff Performance and Lead Source,
// the sections most useful to re-slice in a spreadsheet. Built from the
// same `data` object the page renders and the PDF exports, so it can never
// disagree with either.
export function buildReportsCsv(data: ReportsData): string {
  const lines: string[] = [];
  lines.push(`Report period,${data.period.from} to ${data.period.to}`);
  lines.push("");

  lines.push("Executive Summary");
  lines.push(csvRows([
    ["Metric", "Current", "Previous", "Change %"],
    ["Total Leads", data.executiveSummary.totalLeads.current, data.executiveSummary.totalLeads.previous, data.executiveSummary.totalLeads.changePct ?? ""],
    ["New Leads", data.executiveSummary.newLeadsCount, "", ""],
    ["Qualified Leads", data.executiveSummary.qualifiedCount, "", ""],
    ["Won Deals", data.executiveSummary.wonCount.current, data.executiveSummary.wonCount.previous, data.executiveSummary.wonCount.changePct ?? ""],
    ["Won Value", data.executiveSummary.wonValue.current, data.executiveSummary.wonValue.previous, data.executiveSummary.wonValue.changePct ?? ""],
    ["Quoted Deals", data.executiveSummary.quotedCount.current, data.executiveSummary.quotedCount.previous, data.executiveSummary.quotedCount.changePct ?? ""],
    ["Quoted Value", data.executiveSummary.quotedValue.current, data.executiveSummary.quotedValue.previous, data.executiveSummary.quotedValue.changePct ?? ""],
    ["Pipeline Value", data.executiveSummary.pipelineValue, "", ""],
    ["Average Won Value", data.executiveSummary.averageWonValue ?? "", "", ""],
    ["Average Quotation Value", data.executiveSummary.averageQuotationValue ?? "", "", ""],
    ["Overall Win Rate", data.executiveSummary.overallWonRate ?? "", "", ""],
  ]));
  lines.push("");

  lines.push("Pipeline Distribution");
  lines.push(csvRows([["Stage", "Leads"], ...PIPELINE_STATUSES.map((st) => [LEAD_STATUS_LABELS[st], data.pipelineDistribution.statusBreakdown[st]])]));
  lines.push("");

  if (data.staffPerformance.length > 0) {
    lines.push("Staff Performance");
    lines.push(
      csvRows([
        ["Staff", "Leads", "Won", "Won Value", "Follow-ups Completed", "Overdue", "Avg Qualification"],
        ...data.staffPerformance.map((r) => [r.displayName, r.leadsAssigned, r.wonCount, r.wonValue, r.followUpsCompleted, r.followUpsOverdue, r.avgQualificationScore ?? ""]),
      ]),
    );
    lines.push("");
  }

  if (data.leadSourceBreakdown.length > 0) {
    lines.push("Lead Source Breakdown");
    lines.push(csvRows([["Source", "Leads", "Percentage"], ...data.leadSourceBreakdown.map((r) => [r.label, r.count, r.percentage])]));
  }

  return lines.join("\n");
}
