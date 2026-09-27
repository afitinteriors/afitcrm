import Link from "next/link";
import { BUSINESS_TZ } from "@/lib/business-time";
import { StaffFollowUpCard } from "@/components/dashboard/StaffFollowUpCard";
import { StaffKpiTiles } from "@/components/dashboard/StaffKpiTiles";
import { StaffQuickActions } from "@/components/dashboard/StaffQuickActions";
import { StaffTodayProgress } from "@/components/dashboard/StaffTodayProgress";
import { StaffMonthStats } from "@/components/dashboard/StaffMonthStats";
import { StaffPipelineValue } from "@/components/dashboard/StaffPipelineValue";
import { StaffQuickLinks } from "@/components/dashboard/StaffQuickLinks";
import type { StaffHomeBoard, StaffHomeItem } from "@/lib/staff-home";
import type { TodayFollowUpProgress } from "@/lib/dashboard-brain";
import type { StaffOverview } from "@/lib/leads";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: BUSINESS_TZ,
});

function todayIsoInBusinessZone(): string {
  const now = new Date();
  return DATE_FORMATTER.format(now);
}

function ListSection({
  id,
  title,
  tone,
  items,
  totalCount,
  empty,
  viewAllHref,
}: {
  id: string;
  title: string;
  tone: "now" | "today" | "new";
  items: StaffHomeItem[];
  // Real total, when `items` is a capped preview (the desktop right-rail
  // "New leads" panel) -- so the header count never disagrees with "View
  // all"'s actual destination.
  totalCount?: number;
  empty: string;
  viewAllHref?: string;
}) {
  const HEADER_TONE: Record<typeof tone, { bg: string; text: string }> = {
    now: { bg: "bg-danger-soft", text: "text-danger" },
    today: { bg: "bg-warning-soft", text: "text-warning" },
    new: { bg: "bg-blue-50", text: "text-blue-700" },
  };
  const h = HEADER_TONE[tone];

  const icon =
    tone === "now" ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-5 w-5 shrink-0 ${h.text}`} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ) : tone === "today" ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-5 w-5 shrink-0 ${h.text}`} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
        />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-5 w-5 shrink-0 ${h.text}`} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0"
        />
      </svg>
    );

  // The whole header row is one tap target to viewAllHref (not just the
  // "View all" text) -- -m-2 p-2 grows the tappable/clickable area without
  // moving anything visually, matching this project's touch-target rule.
  // "View all" always shows once a real destination exists, even at zero
  // items, so the section never silently loses its own navigation.
  const header = (
    <div className="flex items-center gap-2 px-1">
      {icon}
      <h2 id={`${id}-title`} className={`text-sm font-semibold ${h.text}`}>
        {title} ({totalCount ?? items.length})
      </h2>
      {viewAllHref && <span className={`ml-auto text-xs font-semibold ${h.text}`}>View all</span>}
    </div>
  );

  return (
    <section aria-labelledby={`${id}-title`} data-testid={`staff-section-${id}`} className={`rounded-2xl p-3 ${h.bg}`}>
      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="-my-3 flex min-h-11 items-center rounded-lg py-3 transition-colors hover:bg-black/5 active:bg-black/10"
        >
          {header}
        </Link>
      ) : (
        header
      )}
      {items.length === 0 ? (
        viewAllHref ? (
          <Link
            href={viewAllHref}
            className="mt-2 block rounded-xl border border-dashed border-border bg-card px-4 py-4 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40"
          >
            {empty}
          </Link>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-border bg-card px-4 py-4 text-center text-sm text-muted-foreground">{empty}</p>
        )
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <StaffFollowUpCard key={item.key} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Staff Dashboard -- rebuilt to match the approved reference design
// (design/staff-dashboard-reference*.png) while staying on the same
// canonical data every other staff surface uses: board comes from
// buildStaffHome() (lib/staff-home.ts, itself grouping getMyDutyQueue()'s
// deduped DutyItem[]), so a lead can never appear here disagreeing with
// what /follow-ups or /today would show for it.
export function StaffHome({
  firstName,
  board,
  todayProgress,
  siteVisitsToday,
  overview,
}: {
  firstName: string | null;
  board: StaffHomeBoard;
  todayProgress: TodayFollowUpProgress;
  siteVisitsToday: number;
  overview: StaffOverview;
}) {
  const nothingToDo = board.newLeads.length + board.followUpNow.length + board.followUpToday.length === 0;
  const newLeadsToday = board.newLeads.filter((item) => {
    const created = new Date(item.createdAt);
    const now = new Date();
    return created.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{firstName ? `Hi, ${firstName} 👋` : "Hi there 👋"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nothingToDo ? "You're all caught up — no new leads and no follow-ups due." : "Here's your sales overview for today."}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {todayIsoInBusinessZone()}
        </span>
      </div>

      <StaffKpiTiles
        followUpNow={board.followUpNow.length}
        followUpToday={board.followUpToday.length}
        newLeads={board.newLeads.length}
        other={board.other.length}
      />

      <StaffQuickActions />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <ListSection id="follow-up-now" title="Follow up now" tone="now" items={board.followUpNow} empty="No overdue follow-ups." viewAllHref="/follow-ups" />
          <ListSection id="follow-up-today" title="Follow up today" tone="today" items={board.followUpToday} empty="Nothing due today." viewAllHref="/follow-ups" />

          {/* Mobile only: New leads sits in the main column; on desktop it moves to the right rail below.
              Capped to a short preview (same 5-item cap as the desktop panel below) -- the dashboard is a
              summary, not the full Leads list; "View all" (real total in the header) goes to /leads?status=new. */}
          <div className="lg:hidden">
            <ListSection
              id="new-leads"
              title="New leads"
              tone="new"
              items={board.newLeads.slice(0, 5)}
              totalCount={board.newLeads.length}
              empty="No new leads right now."
              viewAllHref="/leads?status=new"
            />
          </div>

          {board.other.length > 0 && (
            <section aria-labelledby="also-check-title" className="border-t border-border pt-4" data-testid="staff-section-also-check">
              <h2 id="also-check-title" className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Also check · {board.other.length}
              </h2>
              <ul className="mt-2 grid gap-2 lg:grid-cols-2">
                {board.other.map((item) => (
                  <StaffFollowUpCard key={item.key} item={item} />
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <StaffTodayProgress
            done={todayProgress.done}
            pending={todayProgress.pending}
            target={todayProgress.dueToday}
            siteVisitsToday={siteVisitsToday}
            newLeadsToday={newLeadsToday}
          />
          <StaffPipelineValue value={overview.pipelineValue} />
          <div className="hidden lg:block">
            <StaffMonthStats
              totalLeads={overview.totalLeadsThisMonth}
              siteVisits={overview.siteVisitsThisMonth}
              quotations={overview.quotationsThisMonth}
              won={overview.wonThisMonth}
            />
          </div>
          <div className="hidden lg:block">
            <StaffQuickLinks />
          </div>
          <div className="hidden lg:block">
            <ListSection
              id="new-leads-desktop"
              title="New leads"
              tone="new"
              items={board.newLeads.slice(0, 5)}
              totalCount={board.newLeads.length}
              empty="No new leads right now."
              viewAllHref="/leads?status=new"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
