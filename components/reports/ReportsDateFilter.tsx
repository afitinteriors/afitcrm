"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_DATE_PRESETS } from "@/lib/report-date-filters";
import { formatDate } from "@/lib/format";

// Reporting-period control for /reports -- a preset dropdown (+ custom
// From/To when "Custom Range" is picked) submitted as a GET form, same
// interaction pattern as the Leads list's own Created-date filter
// (components/LeadsFilterBar.tsx), but backed by lib/report-date-filters.ts
// (a separate preset set with "This Quarter"), not shared with it.
export function ReportsDateFilter({
  datePreset,
  dateFrom,
  dateTo,
  periodFrom,
  periodTo,
}: {
  datePreset: string;
  dateFrom: string;
  dateTo: string;
  periodFrom: string;
  periodTo: string;
}) {
  const router = useRouter();
  const [showCustomRange, setShowCustomRange] = useState(datePreset === "custom");

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 basis-full sm:basis-auto sm:w-52">
          <label htmlFor="reports-datePreset" className="text-xs font-medium text-muted-foreground">
            Reporting period
          </label>
          <select
            id="reports-datePreset"
            name="datePreset"
            defaultValue={datePreset}
            onChange={(e) => setShowCustomRange(e.target.value === "custom")}
            className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {REPORT_DATE_PRESETS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {showCustomRange && (
          <>
            <div className="min-w-0 grow basis-[calc(50%-0.375rem)] sm:w-40 sm:grow-0 sm:basis-auto">
              <label htmlFor="reports-dateFrom" className="text-xs font-medium text-muted-foreground">
                From
              </label>
              <input
                id="reports-dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="min-w-0 grow basis-[calc(50%-0.375rem)] sm:w-40 sm:grow-0 sm:basis-auto">
              <label htmlFor="reports-dateTo" className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <input
                id="reports-dateTo"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="flex h-11 items-center gap-1.5 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary"
          title="Reload the report with the latest data for this period"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>

        <span className="ml-auto flex min-h-11 items-center text-sm text-muted-foreground">
          Showing: <span className="ml-1 font-medium text-foreground">{formatDate(periodFrom)} – {formatDate(periodTo)}</span>
        </span>
      </form>
    </div>
  );
}
