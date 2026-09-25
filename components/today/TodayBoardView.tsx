import { StatCard } from "@/components/StatCard";
import { TodayItemRow } from "@/components/today/TodayItemRow";
import type { StatTone } from "@/components/StatCard";
import type { TodayBoard, TodayItem } from "@/lib/today";

const ICON = {
  overdue: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />,
  dueToday: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
    />
  ),
  newLeads: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.5v15m7.5-7.5h-15" />,
  unanswered: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
    />
  ),
  noFollowUp: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  ),
  siteVisits: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
    />
  ),
  quotations: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  ),
  negotiations: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
    />
  ),
};

type SectionConfig = {
  id: string;
  title: string;
  hint: string;
  empty: string;
  items: TodayItem[];
  tone: StatTone;
  icon: React.ReactNode;
  tileLabel: string;
  variant?: "default" | "deal";
};

function buildSections(board: TodayBoard): SectionConfig[] {
  return [
    {
      id: "overdue",
      title: "Overdue",
      hint: "Follow-ups past their due date and still open.",
      empty: "No overdue follow-ups. Everything that was due has been handled.",
      items: board.overdue,
      tone: board.overdue.length > 0 ? "danger" : "neutral",
      icon: ICON.overdue,
      tileLabel: "Overdue",
    },
    {
      id: "due-today",
      title: "Due today",
      hint: "Open follow-ups scheduled for today.",
      empty: "Nothing else is due today.",
      items: board.dueToday,
      tone: board.dueToday.length > 0 ? "warning" : "neutral",
      icon: ICON.dueToday,
      tileLabel: "Due today",
    },
    {
      id: "unanswered",
      title: "Unanswered",
      hint: "Customers who messaged on WhatsApp and haven't had a reply yet.",
      empty: "No unanswered messages right now.",
      items: board.unanswered,
      tone: board.unanswered.length > 0 ? "warning" : "neutral",
      icon: ICON.unanswered,
      tileLabel: "Unanswered",
    },
    {
      id: "new-leads",
      title: "New / uncontacted",
      hint: "New leads with no follow-up yet — they still need a first contact.",
      empty: "No new leads are waiting for a first contact.",
      items: board.newLeads,
      tone: board.newLeads.length > 0 ? "accent" : "neutral",
      icon: ICON.newLeads,
      tileLabel: "New leads",
    },
    {
      id: "no-follow-up",
      title: "No follow-up scheduled",
      hint: "Open leads with nothing scheduled — not new, not a deal in progress.",
      empty: "Every other open lead has a next step scheduled.",
      items: board.noFollowUp,
      tone: board.noFollowUp.length > 0 ? "warning" : "neutral",
      icon: ICON.noFollowUp,
      tileLabel: "No follow-up",
    },
    {
      id: "site-visits",
      title: "Site visits today",
      hint: "Visits scheduled for today.",
      empty: "No site visits are scheduled for today.",
      items: board.siteVisits,
      tone: board.siteVisits.length > 0 ? "accent" : "neutral",
      icon: ICON.siteVisits,
      tileLabel: "Site visits",
    },
    {
      id: "quotations",
      title: "Quotations needing attention",
      hint: "Quotation-stage leads with a follow-up due, or none scheduled.",
      empty: "No quotations need attention right now.",
      items: board.quotations,
      tone: board.quotations.length > 0 ? "warning" : "neutral",
      icon: ICON.quotations,
      tileLabel: "Quotations",
      variant: "deal",
    },
    {
      id: "negotiations",
      title: "Negotiations needing attention",
      hint: "Negotiation-stage leads with a follow-up due, or none scheduled.",
      empty: "No negotiations need attention right now.",
      items: board.negotiations,
      tone: board.negotiations.length > 0 ? "warning" : "neutral",
      icon: ICON.negotiations,
      tileLabel: "Negotiations",
      variant: "deal",
    },
  ];
}

function Section({ section, showAssignee }: { section: SectionConfig; showAssignee: boolean }) {
  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="scroll-mt-4 rounded-xl border border-border bg-card shadow-sm"
      data-testid={`today-section-${section.id}`}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id={`${section.id}-title`} className="text-sm font-semibold text-foreground">
            {section.title}
          </h2>
          <p className="text-xs text-muted-foreground">{section.hint}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {section.items.length}
        </span>
      </div>

      {section.items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground" data-testid="today-empty">
          {section.empty}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {section.items.map((item) => (
            <TodayItemRow key={item.key} item={item} showAssignee={showAssignee} variant={section.variant} />
          ))}
        </ul>
      )}
    </section>
  );
}

// Desktop-first command center. Six summary tiles jump to their sections;
// the sections sit in two columns (people to contact on the left, the
// pipeline on the right) and simply stack in a single column on a narrow
// viewport -- no separate mobile design, and the mobile navigation is
// unchanged.
export function TodayBoardView({
  board,
  showAssignee,
  dateLabel,
}: {
  board: TodayBoard;
  showAssignee: boolean;
  dateLabel: string;
}) {
  const sections = buildSections(board);
  const bySection = Object.fromEntries(sections.map((s) => [s.id, s]));
  const left = ["overdue", "due-today", "unanswered", "new-leads", "no-follow-up"].map((id) => bySection[id]);
  const right = ["site-visits", "quotations", "negotiations"].map((id) => bySection[id]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Today</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        What needs attention across your pipeline today · {dateLabel}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="today-tiles">
        {sections.map((section) => (
          <StatCard
            key={section.id}
            label={section.tileLabel}
            value={section.items.length}
            icon={section.icon}
            tone={section.tone}
            href={`#${section.id}`}
          />
        ))}
      </div>

      {board.total === 0 && (
        <div
          className="mt-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm"
          data-testid="today-all-clear"
        >
          <p className="text-sm font-medium text-foreground">You&apos;re all caught up for today.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No overdue or due follow-ups, no unanswered messages, no new leads waiting, no site visits today, and no
            quotation, negotiation, or stale open lead needs a nudge.
          </p>
        </div>
      )}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {left.map((section) => (
            <Section key={section.id} section={section} showAssignee={showAssignee} />
          ))}
        </div>
        <div className="space-y-4">
          {right.map((section) => (
            <Section key={section.id} section={section} showAssignee={showAssignee} />
          ))}
        </div>
      </div>
    </div>
  );
}
