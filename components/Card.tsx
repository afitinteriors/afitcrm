export function Card({
  title,
  action,
  children,
  variant = "default",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  // "glass" opts a single call site into the dark-glass surface (Phase 0a
  // tokens: --glass-fill/--surface-foreground) without changing the default
  // light card used everywhere else -- see AFIT CRM CLAUDE.md's UI/UX rules.
  variant?: "default" | "glass";
}) {
  const containerClass =
    variant === "glass"
      ? "rounded-xl border border-white/10 bg-glass p-4 shadow-sm backdrop-blur-sm"
      : "rounded-xl border border-border bg-card p-4 shadow-sm";
  const titleClass = variant === "glass" ? "text-sm font-semibold text-surface-foreground" : "text-sm font-semibold text-foreground";

  return (
    <div className={containerClass}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className={titleClass}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
