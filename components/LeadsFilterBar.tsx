import Link from "next/link";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";

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
  return (
    <form
      method="get"
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label htmlFor="search" className="block text-xs font-medium text-slate-500">
          Search
        </label>
        <input
          id="search"
          name="search"
          type="text"
          defaultValue={search}
          placeholder="Customer name or phone"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="sm:w-48">
        <label htmlFor="status" className="block text-xs font-medium text-slate-500">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={status}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:w-48">
        <label htmlFor="campaign" className="block text-xs font-medium text-slate-500">
          Campaign
        </label>
        <select
          id="campaign"
          name="campaign"
          defaultValue={campaign}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Filter
        </button>
        {(search || status || campaign) && (
          <Link
            href="/leads"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
