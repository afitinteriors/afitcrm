type Tile = { count: number; label: string; sublabel: string; tone: "danger" | "warning" | "info" | "success" };

const TONE_CLASSES: Record<Tile["tone"], { bg: string; iconBg: string; iconText: string; count: string }> = {
  danger: { bg: "bg-danger-soft", iconBg: "bg-danger/15", iconText: "text-danger", count: "text-danger" },
  warning: { bg: "bg-warning-soft", iconBg: "bg-warning/15", iconText: "text-warning", count: "text-warning" },
  info: { bg: "bg-blue-50", iconBg: "bg-blue-500/15", iconText: "text-blue-600", count: "text-blue-600" },
  success: { bg: "bg-emerald-50", iconBg: "bg-emerald-500/15", iconText: "text-emerald-600", count: "text-emerald-600" },
};

const ICONS: Record<Tile["tone"], string> = {
  danger: "M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z",
  warning: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5",
  info: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a7.5 7.5 0 0115 0",
  success: "M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
};

// Four real counts from the same canonical StaffHomeBoard the lists below
// render -- no separate tally, so a tile can never disagree with what
// clicking through actually shows.
export function StaffKpiTiles({
  followUpNow,
  followUpToday,
  newLeads,
  other,
}: {
  followUpNow: number;
  followUpToday: number;
  newLeads: number;
  other: number;
}) {
  const tiles: Tile[] = [
    { count: followUpNow, label: "Follow up now", sublabel: "Overdue leads", tone: "danger" },
    { count: followUpToday, label: "Follow up today", sublabel: "Due today", tone: "warning" },
    { count: newLeads, label: "New leads", sublabel: "Not contacted yet", tone: "info" },
    { count: other, label: "Also check", sublabel: "Needs attention", tone: "success" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => {
        const tone = TONE_CLASSES[tile.tone];
        return (
          <div key={tile.label} className={`min-w-0 rounded-2xl p-4 ${tone.bg}`}>
            <span className={`flex h-9 w-9 items-center justify-center rounded-full ${tone.iconBg} ${tone.iconText}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[tile.tone]} />
              </svg>
            </span>
            <p className={`mt-2 text-2xl font-bold leading-none ${tone.count}`}>{tile.count}</p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">{tile.label}</p>
            <p className="text-xs text-muted-foreground">{tile.sublabel}</p>
          </div>
        );
      })}
    </div>
  );
}
