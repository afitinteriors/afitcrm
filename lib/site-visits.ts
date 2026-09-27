import type { LeadListRow } from "@/lib/leads";
import { businessDate, businessDateOf } from "@/lib/business-time";

export type SiteVisitLead = LeadListRow & { site_visit_date: string };

export type SiteVisitGroups = {
  today: SiteVisitLead[];
  upcoming: SiteVisitLead[];
  past: SiteVisitLead[];
};

// site_visit_date is a full timestamp (SiteVisitForm uses a datetime-local
// input), so "today" is a calendar-day match, same comparison style as
// groupFollowUpsByDueDate -- but a past visit isn't a failure the way an
// overdue follow-up is, so the bucket is "Past", not "Overdue". Shared by
// /site-visits and the Admin Dashboard's site-visits panel -- one grouping
// definition, not two.
export function groupBySiteVisitDate(leads: SiteVisitLead[]): SiteVisitGroups {
  const today = businessDate();
  const groups: SiteVisitGroups = { today: [], upcoming: [], past: [] };

  for (const lead of leads) {
    const day = businessDateOf(lead.site_visit_date) ?? "";
    if (day === today) groups.today.push(lead);
    else if (day > today) groups.upcoming.push(lead);
    else groups.past.push(lead);
  }

  return groups;
}
