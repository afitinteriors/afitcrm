"use client";

import { useRouter } from "next/navigation";
import { isFollowUpOverdue } from "@/lib/follow-up-status";
import type { UpcomingFollowUp } from "@/lib/follow-ups";
import type { UnansweredConversation } from "@/lib/conversations";
import type { UncontactedLead } from "@/lib/leads";
import { formatRelative, formatDate } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";

type Tone = "danger" | "warning";

const TONE_ICON_CLASSES: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

const TONE_BADGE_CLASSES: Record<Tone, string> = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

function AttentionRow({
  href,
  icon,
  tone,
  title,
  subtitle,
  badge,
  action,
}: {
  href: string;
  icon: React.ReactNode;
  tone: Tone;
  title: string;
  subtitle: string;
  badge?: string;
  action?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      className="flex min-h-11 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary active:bg-secondary"
    >
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_ICON_CLASSES[tone]}`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {title}
          {badge && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE_BADGE_CLASSES[tone]}`}
            >
              {badge}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {action && (
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="border-t border-border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

// Same chat-bubble glyph as the Conversations nav item / Chats mobile tab --
// the literal WhatsApp brand mark doesn't stay legible at this badge size
// (16px), and reusing this icon keeps "conversation" meaning one consistent
// shape across the app rather than introducing a second, illegible one.
const WhatsAppIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
    />
  </svg>
);

const NewLeadIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 7.5v6m3-3h-6M6.75 7.5a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM1.5 19.5a5.25 5.25 0 0110.5 0" />
  </svg>
);

const ClockIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
  </svg>
);

export function NeedsAttention({
  unanswered,
  uncontacted,
  overdueFollowUps,
}: {
  unanswered: UnansweredConversation[];
  uncontacted: UncontactedLead[];
  overdueFollowUps: UpcomingFollowUp[];
}) {
  const overdue = overdueFollowUps.filter(isFollowUpOverdue);
  const totalCount = unanswered.length + uncontacted.length + overdue.length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
        {totalCount > 0 && (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
            {totalCount}
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">No items need attention</p>
      ) : (
        <div>
          {unanswered.length > 0 && (
            <Section title="Unanswered WhatsApp">
              {unanswered.map((c) => (
                <li key={c.id}>
                  <AttentionRow
                    href={`/conversations/${c.id}`}
                    icon={WhatsAppIcon}
                    tone="danger"
                    title={c.lead?.customer_name || c.wa_id}
                    subtitle={`Waiting ${formatRelative(c.lastInboundAt)} · ${
                      c.lead?.assigned?.display_name || "Unassigned"
                    }`}
                    badge="Unanswered"
                  />
                </li>
              ))}
            </Section>
          )}

          {uncontacted.length > 0 && (
            <Section title="New leads not contacted">
              {uncontacted.map((lead) => (
                <li key={lead.id}>
                  <AttentionRow
                    href={`/leads/${lead.id}`}
                    icon={NewLeadIcon}
                    tone="warning"
                    title={lead.customer_name || "Unnamed lead"}
                    subtitle={`Created ${formatRelative(lead.created_at)} · ${
                      lead.assigned?.display_name || "Unassigned"
                    }`}
                  />
                </li>
              ))}
            </Section>
          )}

          {overdue.length > 0 && (
            <Section title="Overdue follow-ups">
              {overdue.map((followUp) => (
                <li key={followUp.id}>
                  <AttentionRow
                    href={`/leads/${followUp.lead_id}`}
                    icon={ClockIcon}
                    tone="danger"
                    title={`${FOLLOW_UP_TYPE_LABELS[followUp.type]} · ${followUp.lead?.customer_name || "Unnamed lead"}`}
                    subtitle={`Due ${formatDate(followUp.due_date)}`}
                    badge="Overdue"
                    action={<CompleteFollowUpButton followUpId={followUp.id} leadId={followUp.lead_id} />}
                  />
                </li>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
