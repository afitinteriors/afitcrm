"use client";

import { useState } from "react";
import type { ReportsData } from "@/lib/reports";
import { buildReportsCsv, buildReportsPdf } from "@/lib/reports-export";

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Client-side export: builds from the exact ReportsData already rendered
// on this page (passed down as a prop, not re-fetched), so the PDF/CSV can
// never disagree with what's on screen.
export function ReportsExportButtons({ data, generatedBy }: { data: ReportsData; generatedBy: string }) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  async function handlePdf() {
    setBusy("pdf");
    try {
      const doc = buildReportsPdf(data, {
        companyName: "AFIT Business OS",
        reportTitle: "Management Analytics Report",
        generatedAt: new Date(),
        generatedBy,
      });
      doc.save(`afit-management-report_${data.period.from}_to_${data.period.to}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  function handleCsv() {
    setBusy("csv");
    try {
      const csv = buildReportsCsv(data);
      downloadBlob(csv, `afit-report-data_${data.period.from}_to_${data.period.to}.csv`, "text/csv;charset=utf-8");
    } finally {
      setBusy(null);
    }
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
    </div>
  );
}
