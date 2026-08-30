import Link from "next/link";
import { PIPELINE_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";

type Filters = { search: string; status: string; campaign: string };

function hrefWithout(omit: keyof Filters, current: Filters) {
  const params = new URLSearchParams();
  (Object.keys(current) as (keyof Filters)[]).forEach((key) => {
    if (key !== omit && current[key]) params.set(key, current[key]);
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

export function LeadsFilterBar({
  search,
  status,
  campaign,
  campaignOptions,
}: {
  search: string;
  status: string;
  campaign: string;
  campaignOptions: string[];
}) {
  const current: Filters = { search, status, campaign };
  const hasFilters = Boolean(search || status || campaign);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="search" className="block text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative mt-1">
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

        <div className="sm:w-48">
          <label htmlFor="status" className="block text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All statuses</option>
            {PIPELINE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-48">
          <label htmlFor="campaign" className="block text-xs font-medium text-muted-foreground">
            Campaign
          </label>
          <select
            id="campaign"
            name="campaign"
            defaultValue={campaign}
            className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All campaigns</option>
            {campaignOptions.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filter
          </button>
          {hasFilters && (
            <Link
              href="/leads"
              className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              Clear all
            </Link>
          )}
        </div>
      </form>

      {hasFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Active:</span>
          {search && <FilterChip label={`Search: "${search}"`} href={hrefWithout("search", current)} />}
          {status && (
            <FilterChip
              label={`Status: ${LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS] ?? status}`}
              href={hrefWithout("status", current)}
            />
          )}
          {campaign && <FilterChip label={`Campaign: ${campaign}`} href={hrefWithout("campaign", current)} />}
        </div>
      )}
    </div>
  );
}
