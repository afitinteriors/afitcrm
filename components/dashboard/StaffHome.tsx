import Link from "next/link";
import { DoThisNowCard } from "@/components/dashboard/DoThisNowCard";
import { DutyList } from "@/components/dashboard/DutyList";
import { StatCard } from "@/components/StatCard";
import type { DutyQueue } from "@/lib/dashboard-brain";
import type { UpcomingFollowUp } from "@/lib/follow-ups";
import { formatDate } from "@/lib/format";
import { businessDate } from "@/lib/business-time";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";

const CLOCK_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />;
const CHECK_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
const CHAT_ICON = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />;

function UpcomingList({ items }: { items: UpcomingFollowUp[] }) {
  if (items.length === 0) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing scheduled yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((f) => (
        <li key={f.id}>
          <Link href={`/leads/${f.lead_id}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-secondary">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{f.lead?.customer_name || "Unnamed lead"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {FOLLOW_UP_TYPE_LABELS[f.type]} · {formatDate(f.due_date)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Staff desktop + mobile home. Deliberately NOT the Admin dashboard with
// sections hidden -- see docs/strategy/follow-up-brain/06 §9/§11. Desktop
// shows the full hierarchy (Duty Now, Overdue, Today, Upcoming, Other
// Work); mobile shows only what a salesperson needs mid-day (Duty Now,
// Overdue, Today) as its own, shorter layout -- not a shrunk copy of the
// desktop tree.
export function StaffHome({
  firstName,
  queue,
  upcoming,
}: {
  firstName: string | null;
  queue: DutyQueue;
  upcoming: UpcomingFollowUp[];
}) {
  const overdueItems = queue.items.filter((i) => i.reasonKind === "overdue_follow_up");
  const dueTodayItems = queue.items.filter((i) => i.reasonKind === "due_today_follow_up");
  const otherItems = queue.items.filter(
    (i) => i.reasonKind === "unanswered_conversation" || i.reasonKind === "uncontacted_lead" || i.reasonKind === "no_follow_up",
  );
  const dueSoon = upcoming.filter((f) => f.due_date > businessDate());
  const topItem = queue.items[0] ?? null;
  const restItems = queue.items.slice(1);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{firstName ? `Hi, ${firstName}` : "My Work"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what the system recommends you do next.</p>

      {/* ---------- Desktop ---------- */}
      <div className="mt-5 hidden lg:block">
        <DoThisNowCard item={topItem} />

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatCard label="Overdue" value={overdueItems.length} icon={CLOCK_ICON} tone={overdueItems.length > 0 ? "danger" : "neutral"} />
          <StatCard label="Due Today" value={dueTodayItems.length} icon={CHECK_ICON} tone={dueTodayItems.length > 0 ? "warning" : "neutral"} />
          <StatCard label="Unanswered Chats" value={queue.counts.unanswered} icon={CHAT_ICON} tone={queue.counts.unanswered > 0 ? "warning" : "neutral"} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">My Overdue</h2>
            </div>
            <DutyList items={overdueItems} emptyLabel="No overdue work." />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">My Follow-ups Today</h2>
            </div>
            <DutyList items={dueTodayItems} emptyLabel="Nothing due today." />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">My Upcoming</h2>
            </div>
            <UpcomingList items={dueSoon} />
          </div>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">My Active Leads / Other Work</h2>
            </div>
            <DutyList items={otherItems} emptyLabel="Nothing else needs attention." />
          </div>
        </div>
      </div>

      {/* ---------- Mobile ---------- */}
      <div className="mt-5 space-y-4 lg:hidden">
        <DoThisNowCard item={topItem} />

        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Overdue" value={overdueItems.length} icon={CLOCK_ICON} tone={overdueItems.length > 0 ? "danger" : "neutral"} />
          <StatCard label="Due Today" value={dueTodayItems.length} icon={CHECK_ICON} tone={dueTodayItems.length > 0 ? "warning" : "neutral"} />
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Next up</h2>
          </div>
          <DutyList items={restItems.slice(0, 8)} emptyLabel="Nothing else needs attention." />
        </div>
      </div>
    </div>
  );
}
