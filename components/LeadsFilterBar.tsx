"use client";

import { useState } from "react";
import Link from "next/link";
import { PIPELINE_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";
import { DATE_PRESETS, isDatePreset, resolveDateRange } from "@/lib/lead-date-filters";
import { formatDate } from "@/lib/format";

type Filters = { search: string; status: string; campaign: string; assignment: string; datePreset: string; dateFrom: string; dateTo: string };

const DATE_KEYS: (keyof Filters)[] = ["datePreset", "dateFrom", "dateTo"];

function hrefWithout(omit: (keyof Filters)[], current: Filters) {
  const params = new URLSearchParams();
  (Object.keys(current) as (keyof Filters)[]).forEach((key) => {
    if (!omit.includes(key) && current[key]) params.set(key, current[key]);
  });
  const qs = params.toString();
  return qs ? `/leads?${qs}` : "/leads";
}

function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-foreground hover:bg-muted"
    >
      {label}
      <span aria-hidden="true" className="text-muted-foreground">
        &times;
      </span>
    </Link>
  );
}

// Human label for the active date filter -- reused by the "Active" chip row.
// Named presets show their own label ("Last 7 days"); custom shows the
// resolved from/to range formatted the same way the rest of the app shows a
// date (formatDate, business-zone). Falls back to null when nothing valid is
// selected, so the chip never renders a bogus/empty "Created:" tag.
function describeDateFilter(datePreset: string, dateFrom: string, dateTo: string): string | null {
  if (!datePreset || !isDatePreset(datePreset)) return null;
  if (datePreset !== "custom") {
    return DATE_PRESETS.find((p) => p.id === datePreset)?.label ?? null;
  }
  const range = resolveDateRange({ datePreset, dateFrom, dateTo });
  if (!range) return null;
  return `${formatDate(range.from)} – ${formatDate(range.to)}`;
}

export function LeadsFilterBar({
  search,
  status,
  campaign,
  assignment,
  showAssignment,
  campaignOptions,
  datePreset,
  dateFrom,
  dateTo,
}: {
  search: string;
  status: string;
  campaign: string;
  assignment: string;
  // Admin only: staff lists are already limited to their own leads.
  showAssignment: boolean;
  campaignOptions: string[];
  datePreset: string;
  dateFrom: string;
  dateTo: string;
}) {
  const current: Filters = { search, status, campaign, assignment, datePreset, dateFrom, dateTo };
  const hasFilters = Boolean(search || status || campaign || assignment || datePreset);
  const [showCustomRange, setShowCustomRange] = useState(datePreset === "custom");
  const dateLabel = describeDateFilter(datePreset, dateFrom, dateTo);

  return (
    <div className="rounded-lg border border-border bg-card p-2.5 shadow-sm sm:p-4">
      <form method="get" className="space-y-2.5 sm:space-y-3">
        {/* Mobile: search + Filter on one row, Status + Campaign on the next
            (labels are screen-reader-only). From sm up this is the original
            single-row toolbar. */}
        <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap sm:gap-3">
          <div
            className={`order-1 min-w-0 ${hasFilters ? "basis-[calc(100%-10.25rem)]" : "basis-[calc(100%-5.25rem)]"} sm:order-none sm:flex-1 sm:basis-auto`}
          >
            <label htmlFor="search" className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:block">
              Search
            </label>
            <div className="relative mt-0 sm:mt-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                id="search"
                name="search"
                type="text"
                defaultValue={search}
                placeholder="Customer name or phone"
                className="block h-11 w-full rounded-md border border-border pl-9 pr-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="order-3 min-w-0 grow basis-[calc(50%-0.25rem)] sm:order-none sm:w-48 sm:grow-0 sm:basis-auto">
            <label htmlFor="status" className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:block">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="mt-0 sm:mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All statuses</option>
              {PIPELINE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="order-4 min-w-0 grow basis-[calc(50%-0.25rem)] sm:order-none sm:w-48 sm:grow-0 sm:basis-auto">
            <label htmlFor="campaign" className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:block">
              Campaign
            </label>
            <select
              id="campaign"
              name="campaign"
              defaultValue={campaign}
              className="mt-0 sm:mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All campaigns</option>
              {campaignOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="order-2 flex shrink-0 gap-2 sm:order-none">
            <button
              type="submit"
              className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Filter
            </button>
            {hasFilters && (
              <Link
                href="/leads"
                className="flex h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-muted-foreground sm:px-4 hover:bg-secondary"
              >
                Clear all
              </Link>
            )}
          </div>
        </div>

        {/* Created-date filter: a separate flex container (its own line at
            every width), so it never competes for space with the row above --
            nesting a w-full row inside the sm:flex-nowrap row above squeezed
            every other control down to a sliver at 768px (a real bug caught
            during verification, not a hypothetical). Custom range's two date
            inputs only render once "Custom range" is picked. */}
        <div className="flex flex-wrap items-end gap-2 border-t border-border pt-2.5 sm:pt-3">
          <div className="min-w-0 basis-full sm:basis-auto sm:w-48">
            <label htmlFor="datePreset" className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:block">
              Created
            </label>
            <select
              id="datePreset"
              name="datePreset"
              defaultValue={datePreset}
              onChange={(e) => setShowCustomRange(e.target.value === "custom")}
              className="mt-0 sm:mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Any date</option>
              {DATE_PRESETS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {showAssignment && (
            <div className="min-w-0 basis-full sm:basis-auto sm:w-48">
              <label htmlFor="assignment" className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:block">
                Assignment
              </label>
              <select
                id="assignment"
                name="assignment"
                defaultValue={assignment}
                className="mt-0 sm:mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All leads</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          )}

          {showCustomRange && (
            <>
              <div className="min-w-0 grow basis-[calc(50%-0.25rem)] sm:w-40 sm:grow-0 sm:basis-auto">
                <label htmlFor="dateFrom" className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:block">
                  From
                </label>
                <input
                  id="dateFrom"
                  name="dateFrom"
                  type="date"
                  defaultValue={dateFrom}
                  className="mt-0 sm:mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="min-w-0 grow basis-[calc(50%-0.25rem)] sm:w-40 sm:grow-0 sm:basis-auto">
                <label htmlFor="dateTo" className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:block">
                  To
                </label>
                <input
                  id="dateTo"
                  name="dateTo"
                  type="date"
                  defaultValue={dateTo}
                  className="mt-0 sm:mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}
        </div>
      </form>

      {(hasFilters || dateLabel) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Active:</span>
          {search && <FilterChip label={`Search: "${search}"`} href={hrefWithout(["search"], current)} />}
          {status && (
            <FilterChip
              label={`Status: ${LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS] ?? status}`}
              href={hrefWithout(["status"], current)}
            />
          )}
          {campaign && <FilterChip label={`Campaign: ${campaign}`} href={hrefWithout(["campaign"], current)} />}
          {dateLabel && <FilterChip label={`Created: ${dateLabel}`} href={hrefWithout(DATE_KEYS, current)} />}
        </div>
      )}
    </div>
  );
}
