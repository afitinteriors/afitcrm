import Link from "next/link";
import type { ScheduleItem } from "@/lib/dashboard-brain";

const KIND_ICON: Record<ScheduleItem["kind"], string> = {
  follow_up: "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  site_visit: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
};

// Today's pending follow-ups + today's site visits, merged and time-sorted
// (see getTodaysSchedule) -- real due_time/site_visit_date values only; an
// item with no recorded time is listed last, never given a fabricated slot.
export function TodaysScheduleList({ items }: { items: ScheduleItem[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Today&apos;s Schedule</h2>
        <Link href="/follow-ups" className="text-xs font-medium text-primary hover:underline">
          View Calendar
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing scheduled for today.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={`/leads/${item.leadId}`} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary">
                <span className="mt-0.5 w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{item.time ?? "—"}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={KIND_ICON[item.kind]} />
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.customerName ?? "Unnamed lead"}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
