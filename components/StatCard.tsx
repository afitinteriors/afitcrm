import Link from "next/link";

export type StatTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONE_ICON_CLASSES: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent/15 text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

const TONE_VALUE_CLASSES: Record<StatTone, string> = {
  neutral: "text-foreground",
  accent: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  href,
  emphasize = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: StatTone;
  /** When set, the whole card becomes a link (e.g. to a filtered leads list). */
  href?: string;
  /** Slightly larger value text for the single most important metric on the page. */
  emphasize?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span
          aria-hidden="true"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_CLASSES[tone]}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
            {icon}
          </svg>
        </span>
      </div>
      <p
        className={`mt-2 font-semibold tabular-nums ${TONE_VALUE_CLASSES[tone]} ${
          emphasize ? "text-3xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
    </>
  );

  const className =
    "block rounded-lg border border-border bg-card p-4 shadow-sm transition-colors" +
    (href ? " hover:border-primary/40 hover:bg-secondary" : "");

  if (href) {
    return (
      <Link href={href} className={className} aria-label={`${label}: ${value}. View these leads.`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
