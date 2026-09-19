import Link from "next/link";
import type { DutyItem } from "@/lib/dashboard-brain";

const REASON_BADGE: Record<DutyItem["reasonKind"], { label: string; className: string } | null> = {
  overdue_follow_up: { label: "Overdue", className: "bg-danger-soft text-danger" },
  due_today_follow_up: { label: "Due today", className: "bg-warning-soft text-warning" },
  unanswered_conversation: { label: "Unanswered", className: "bg-warning-soft text-warning" },
  uncontacted_lead: { label: "New", className: "bg-accent/15 text-accent-foreground" },
  no_follow_up: null,
};

// Compact rows for everything in the attention queue that isn't the current
// "My Duty Now" pick -- used for both the Staff "next up" list and the
// Admin team-wide queue. Presentational only; the ordering/selection logic
// lives entirely in lib/dashboard-brain.ts.
export function DutyList({ items, emptyLabel }: { items: DutyItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const href = item.conversationId ? `/conversations/${item.conversationId}` : item.leadId ? `/leads/${item.leadId}` : "#";
        const badge = REASON_BADGE[item.reasonKind];
        return (
          <li key={item.key}>
            <Link href={href} className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.customerName}
                  {badge && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{item.reasonText}</p>
              </div>
              {item.assignedToName && (
                <span className="shrink-0 text-xs text-muted-foreground">{item.assignedToName}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
