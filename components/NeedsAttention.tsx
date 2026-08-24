"use client";

import { useRouter } from "next/navigation";
import { isFollowUpOverdue } from "@/lib/follow-up-status";
import type { UpcomingFollowUp } from "@/lib/follow-ups";
import type { UnansweredConversation } from "@/lib/conversations";
import type { UncontactedLead } from "@/lib/leads";
import { formatRelative, formatDate } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";

function AttentionRow({
  href,
  title,
  subtitle,
  badge,
  action,
}: {
  href: string;
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
      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {title}
          {badge && (
            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
              {badge}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500">{subtitle}</p>
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
      <p className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </div>
  );
}

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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Needs Attention</h2>
      </div>

      {totalCount === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">No items need attention</p>
      ) : (
        <div>
          {unanswered.length > 0 && (
            <Section title="Unanswered WhatsApp">
              {unanswered.map((c) => (
                <li key={c.id}>
                  <AttentionRow
                    href={`/conversations/${c.id}`}
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
