import { StaffLeadCard } from "@/components/dashboard/StaffLeadCard";
import type { StaffHomeBoard, StaffHomeItem } from "@/lib/staff-home";

type SectionTone = "new" | "now" | "today";

const SECTION_ACCENT: Record<SectionTone, { dot: string; count: string }> = {
  new: { dot: "bg-blue-500", count: "bg-blue-50 text-blue-700" },
  now: { dot: "bg-danger", count: "bg-danger-soft text-danger" },
  today: { dot: "bg-warning", count: "bg-warning-soft text-warning" },
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
  tone: SectionTone;
  items: StaffHomeItem[];
  empty: string;
}) {
  const accent = SECTION_ACCENT[tone];
  return (
    <section aria-labelledby={`${id}-title`} data-testid={`staff-section-${id}`}>
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
        <ul className="-mx-2 mt-1 lg:-mx-3">
          {items.map((item) => (
            <StaffLeadCard key={item.key} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Staff home: three questions, most urgent first -- who needs a follow-up
// now, who needs one today, is there a new lead. Overdue work comes first so
// it stays near the top on a phone even when many new leads are waiting.
// Everything comes from the canonical
// attention queue (lib/staff-home.ts groups it; each lead appears once).
// The same single-column layout serves mobile and desktop; on desktop the
// three sections sit side by side. "Also check" holds the remaining open
// items (a customer replied, a lead with no next step) so nothing drops off
// the page, but it is deliberately quieter than the three main sections.
export function StaffHome({ firstName, board }: { firstName: string | null; board: StaffHomeBoard }) {
  const nothingToDo = board.newLeads.length + board.followUpNow.length + board.followUpToday.length === 0;

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">{firstName ? `Hi, ${firstName}` : "My Work"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {nothingToDo ? "You're all caught up — no new leads and no follow-ups due." : "Here's who to contact next."}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-3 lg:gap-5">
        <Section id="follow-up-now" title="Follow up now" tone="now" items={board.followUpNow} empty="No overdue follow-ups." />
        <Section id="follow-up-today" title="Follow up today" tone="today" items={board.followUpToday} empty="Nothing due today." />
        <Section id="new-leads" title="New leads" tone="new" items={board.newLeads} empty="No new leads right now." />
      </div>

      {board.other.length > 0 && (
        <section aria-labelledby="also-check-title" className="mt-8 border-t border-border pt-4" data-testid="staff-section-also-check">
          <h2 id="also-check-title" className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Also check · {board.other.length}
          </h2>
          <ul className="-mx-2 mt-1 grid lg:-mx-3 lg:grid-cols-2">
            {board.other.map((item) => (
              <StaffLeadCard key={item.key} item={item} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
