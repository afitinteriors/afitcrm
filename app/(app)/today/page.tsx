import { getCurrentProfile } from "@/lib/auth";
import { getLeads } from "@/lib/leads";
import { getFollowUps } from "@/lib/follow-ups";
import { getMyDutyQueue } from "@/lib/dashboard-brain";
import { buildTodayBoard } from "@/lib/today";
import { formatDate } from "@/lib/format";
import { businessDate } from "@/lib/business-time";
import { TodayBoardView } from "@/components/today/TodayBoardView";

// Sales "Today" command center -- a read-only view over data the app already
// has: getLeads({}), getFollowUps({ status: "pending" }) (display detail
// only), and getMyDutyQueue() (lib/dashboard-brain.ts -- the SAME canonical
// Duty facts the Dashboard uses; see lib/duty.ts). All three already apply
// the existing visibility rules (admin sees everything, staff only their
// own assigned leads/follow-ups/duties, backed by RLS), so this page adds
// no new query shape, no new field and no permission logic of its own.
// Every row links into the existing Lead Detail, where follow-ups, site
// visits and quotations are already managed -- there is no second detail
// system. "Today" uses the same business-zone (IST) calendar-day convention
// as the Follow-ups and Site Visits pages, so counts agree across all three.
export default async function TodayPage() {
  const profile = await getCurrentProfile();
  const [leads, followUps, dutyQueue] = await Promise.all([
    getLeads({}),
    getFollowUps({ status: "pending" }),
    getMyDutyQueue(),
  ]);

  const today = businessDate();
  const board = buildTodayBoard({ leads, followUps, dutyItems: dutyQueue.items, today });

  return <TodayBoardView board={board} showAssignee={profile?.role === "admin"} dateLabel={formatDate(today)} />;
}
