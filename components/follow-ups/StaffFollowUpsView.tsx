"use client";

import { useMemo, useState } from "react";
import { FollowUpsFilterBar } from "@/components/follow-ups/FollowUpsFilterBar";
import { FollowUpListItem } from "@/components/follow-ups/FollowUpListItem";
import { StaffFollowUpListCard } from "@/components/follow-ups/StaffFollowUpListCard";
import type { FollowUpGroups } from "@/lib/follow-up-status";
import type { FollowUpListItem as FollowUpListItemData } from "@/lib/follow-ups";
import type { StaffOption } from "@/lib/staff";

type TabId = "now" | "today" | "upcoming";

const TABS: { id: TabId; label: string }[] = [
  { id: "now", label: "Follow up now" },
  { id: "today", label: "Follow up today" },
  { id: "upcoming", label: "Upcoming" },
];

function matchesSearch(item: FollowUpListItemData, term: string): boolean {
  if (!term) return true;
  const name = item.lead?.customer_name?.toLowerCase() ?? "";
  const phone = item.lead?.phone?.toLowerCase() ?? "";
  return name.includes(term) || phone.includes(term);
}

// Staff Tasks tab: scheduled follow-ups only -- the real follow_ups rows,
// each with its Complete action -- most urgent first: now (overdue),
// today, upcoming. New leads and other open work live on Staff Home, not
// here. Desktop keeps the existing stacked-sections layout with the
// status/type filter and Completed history (unchanged); mobile is tabs
// (one group visible at a time) plus a search-by-name/phone box, matching
// the approved mobile reference -- same three groups, same underlying
// data (FollowUpGroups from groupFollowUpsByDueDate), just one
// presentation layer per viewport, same split already used on Staff Home.
export function StaffFollowUpsView({
  groups,
  status,
  type,
  assignedTo,
  staffOptions,
}: {
  groups: FollowUpGroups<FollowUpListItemData>;
  status: string;
  type: string;
  assignedTo: string;
  staffOptions: StaffOption[];
}) {
  const nothingDue = groups.overdue.length + groups.today.length === 0;
  const [tab, setTab] = useState<TabId>(groups.overdue.length > 0 ? "now" : groups.today.length > 0 ? "today" : "now");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const byTab = useMemo<Record<TabId, FollowUpListItemData[]>>(
    () => ({ now: groups.overdue, today: groups.today, upcoming: groups.upcoming }),
    [groups.overdue, groups.today, groups.upcoming],
  );
  const term = search.trim().toLowerCase();
  const visible = useMemo(() => byTab[tab].filter((item) => matchesSearch(item, term)), [byTab, tab, term]);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">My Follow-ups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nothingDue ? "You're all caught up — nothing overdue or due today." : "Leads that need your attention"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label={searchOpen ? "Close search" : "Search follow-ups"}
          aria-pressed={searchOpen}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M18.5 11a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
          </svg>
        </button>
      </div>

      {searchOpen && (
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone"
          aria-label="Search follow-ups by name or phone"
          className="mt-3 block w-full rounded-full border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary lg:hidden"
        />
      )}

      <div className="mt-4 hidden lg:block">
        <FollowUpsFilterBar status={status} type={type} assignedTo={assignedTo} staffOptions={staffOptions} />
      </div>

      {/* ---------- Mobile: tabs, one group at a time ---------- */}
      <div className="mt-4 lg:hidden">
        <div role="tablist" aria-label="Follow-up groups" className="flex gap-5 border-b border-border">
          {TABS.map((t) => {
            const count = byTab[t.id].length;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`flex min-h-11 items-center gap-1.5 border-b-2 pb-2.5 text-sm font-semibold transition-colors ${
                  active ? "border-danger text-danger" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    active ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-3">
          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              {term ? `No matches for "${search}".` : TABS.find((t) => t.id === tab)?.id === "now" ? "No overdue follow-ups." : tab === "today" ? "Nothing due today." : "Nothing scheduled."}
            </p>
          ) : (
            visible.map((item) => <StaffFollowUpListCard key={item.id} followUp={item} />)
          )}
        </div>
      </div>

      {/* ---------- Desktop: unchanged stacked sections ---------- */}
      <div className="mt-5 hidden space-y-6 lg:block">
        <Section id="follow-up-now" title="Follow up now" tone="now" items={groups.overdue} empty="No overdue follow-ups." />
        <Section id="follow-up-today" title="Follow up today" tone="today" items={groups.today} empty="Nothing due today." />
        <Section id="upcoming" title="Upcoming" tone="upcoming" items={groups.upcoming} empty="Nothing scheduled." />
      </div>

      {groups.completed.length > 0 && (
        <details className="mt-6 hidden lg:block">
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Completed ({groups.completed.length})
          </summary>
          <div className="mt-2 space-y-2">
            {groups.completed.map((item) => (
              <FollowUpListItem key={item.id} followUp={item} showAssignee={false} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

type Tone = "now" | "today" | "upcoming";

const ACCENT: Record<Tone, { dot: string; count: string }> = {
  now: { dot: "bg-danger", count: "bg-danger-soft text-danger" },
  today: { dot: "bg-warning", count: "bg-warning-soft text-warning" },
  upcoming: { dot: "bg-muted-foreground/60", count: "bg-muted text-muted-foreground" },
};

function Section({
  id,
  title,
  tone,
  items,
  empty,
}: {
  id: string;
  title: string;
  tone: Tone;
  items: FollowUpListItemData[];
  empty: string;
}) {
  const accent = ACCENT[tone];
  return (
    <section aria-labelledby={`${id}-title`} data-testid={`staff-tasks-${id}`}>
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} aria-hidden="true" />
        <h2 id={`${id}-title`} className="text-sm font-semibold uppercase tracking-wide text-foreground">
          {title}
        </h2>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${items.length > 0 ? accent.count : "bg-muted text-muted-foreground"}`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <FollowUpListItem key={item.id} followUp={item} showAssignee={false} />
          ))}
        </div>
      )}
    </section>
  );
}
