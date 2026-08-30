import { FollowUpListItem } from "@/components/follow-ups/FollowUpListItem";
import type { FollowUpListItem as FollowUpListItemData } from "@/lib/follow-ups";

// Renders nothing when there's nothing to show and no emptyLabel was given --
// lets the mobile Today's view skip an "Upcoming" heading it never asks for,
// while the desktop workspace can still show its own empty-state copy per
// section.
export function FollowUpsSection({
  title,
  items,
  showAssignee,
  emptyLabel,
}: {
  title: string;
  items: FollowUpListItemData[];
  showAssignee: boolean;
  emptyLabel?: string;
}) {
  if (items.length === 0 && !emptyLabel) return null;

  return (
    <div className="mt-4 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({items.length})
      </h2>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          items.map((item) => <FollowUpListItem key={item.id} followUp={item} showAssignee={showAssignee} />)
        )}
      </div>
    </div>
  );
}
