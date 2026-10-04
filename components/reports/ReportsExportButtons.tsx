"use client";

import { useState } from "react";
import { exportReportsData } from "@/lib/actions/reports";
import type { ReportDateFilterInput } from "@/lib/report-date-filters";
import { buildReportsCsv, buildReportsPdf } from "@/lib/reports-export";

// A direct, synchronous anchor-click download -- deliberately NOT
// jsPDF's own doc.save(), which internally triggers its click via
// setTimeout(0) (a bundled FileSaver-style helper). That delay moves the
// click outside the original event handler's call stack, which some
// Chrome configurations then no longer treat as a direct user gesture --
// the download either gets held/never completes, or the file that lands
// is empty/unusable, while the PDF bytes themselves (verified separately)
// are fine. Triggering the click synchronously, in the same call stack as
// the button's onClick, avoids that entirely. The object URL is revoked
// a second later, not immediately, so a slower browser has time to finish
// reading a larger file first.
function downloadBlob(content: BlobPart | Blob, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Export is admin-only and enforced on the server: exportReportsData() returns
// an error for any other caller, so no export data is produced for staff even
// if this component is rendered or its action is invoked directly. The page
// renders these buttons only for admins; the server check is the real gate.
// The file is then built in the browser from the same server-computed report
// for the same period the page is showing.
export function ReportsExportButtons({ filters, generatedBy }: { filters: ReportDateFilterInput; generatedBy: string }) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "pdf" | "csv") {
    setBusy(kind);
    setError(null);
    try {
      const result = await exportReportsData(filters);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const { data } = result;
      if (kind === "pdf") {
        const doc = buildReportsPdf(data, {
          companyName: "AFIT Business OS",
          reportTitle: "Management Analytics Report",
          generatedAt: new Date(),
          generatedBy,
        });
        // doc.output("blob") -- the same real, correctly-typed PDF bytes
        // doc.save() would produce -- downloaded via our own direct click,
        // not jsPDF's internal delayed one (see downloadBlob above).
        const blob = doc.output("blob");
        downloadBlob(blob, `afit-management-report_${data.period.from}_to_${data.period.to}.pdf`, "application/pdf");
      } else {
        const csv = buildReportsCsv(data);
        downloadBlob(csv, `afit-report-data_${data.period.from}_to_${data.period.to}.csv`, "text/csv;charset=utf-8");
      }
    } catch {
      setError("Could not prepare the export. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function handlePdf() {
    void run("pdf");
  }

  function handleCsv() {
    void run("csv");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={handlePdf}
        disabled={busy !== null}
        className="flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 12m0 0l4.5-4.5M12 12V3" />
        </svg>
        {busy === "pdf" ? "Generating…" : "Download PDF Report"}
      </button>
      <button
        type="button"
        onClick={handleCsv}
        disabled={busy !== null}
        className="flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 12m0 0l4.5-4.5M12 12V3" />
        </svg>
        {busy === "csv" ? "Preparing…" : "Export CSV"}
      </button>
      {error && (
        <p role="alert" className="w-full text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
