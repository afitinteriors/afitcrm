import Link from "next/link";
import { FOLLOW_UP_TYPES, FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import type { StaffOption } from "@/lib/staff";

type Filters = { status: string; type: string; assignedTo: string };

function hrefWithout(omit: keyof Filters, current: Filters, defaults: Filters) {
  const params = new URLSearchParams();
  (Object.keys(current) as (keyof Filters)[]).forEach((key) => {
    if (key !== omit && current[key] !== defaults[key]) params.set(key, current[key]);
  });
  const qs = params.toString();
  return qs ? `/follow-ups?${qs}` : "/follow-ups";
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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

const DEFAULTS: Filters = { status: "pending", type: "", assignedTo: "" };

// Same GET-form/filter-chip pattern as LeadsFilterBar.tsx -- status defaults
// to "pending" (the actionable view) rather than blank-means-all, since an
// empty task workspace default would bury what the page exists to surface.
// The assignee select only renders when staffOptions is non-empty --
// getAssignableStaff() already returns [] for a non-admin caller, so a staff
// member never sees a control for filtering by someone else's assignment.
export function FollowUpsFilterBar({
  status,
  type,
  assignedTo,
  staffOptions,
}: {
  status: string;
  type: string;
  assignedTo: string;
  staffOptions: StaffOption[];
}) {
  const current: Filters = { status, type, assignedTo };
  const hasNonDefaultFilters = Boolean(type || assignedTo || status !== DEFAULTS.status);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <label htmlFor="status" className="block text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:w-48">
          <label htmlFor="type" className="block text-xs font-medium text-muted-foreground">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type}
            className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All types</option>
            {FOLLOW_UP_TYPES.map((value) => (
              <option key={value} value={value}>
                {FOLLOW_UP_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {staffOptions.length > 0 && (
          <div className="sm:w-48">
            <label htmlFor="assignedTo" className="block text-xs font-medium text-muted-foreground">
              Assigned to
            </label>
            <select
              id="assignedTo"
              name="assignedTo"
              defaultValue={assignedTo}
              className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Everyone</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.display_name || "Unnamed"}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filter
          </button>
          {hasNonDefaultFilters && (
            <Link
              href="/follow-ups"
              className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              Clear all
            </Link>
          )}
        </div>
      </form>

      {hasNonDefaultFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">Active:</span>
          {status !== DEFAULTS.status && (
            <FilterChip
              label={`Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`}
              href={hrefWithout("status", current, DEFAULTS)}
            />
          )}
          {type && (
            <FilterChip
              label={`Type: ${FOLLOW_UP_TYPE_LABELS[type as keyof typeof FOLLOW_UP_TYPE_LABELS] ?? type}`}
              href={hrefWithout("type", current, DEFAULTS)}
            />
          )}
          {assignedTo && (
            <FilterChip
              label={`Assigned: ${staffOptions.find((s) => s.id === assignedTo)?.display_name ?? "Unknown"}`}
              href={hrefWithout("assignedTo", current, DEFAULTS)}
            />
          )}
        </div>
      )}
    </div>
  );
}
