import Link from "next/link";
import { CallButton } from "@/components/lead-actions/CallButton";
import { CompleteFollowUpButton } from "@/components/lead-actions/CompleteFollowUpButton";
import { StatusBadge } from "@/components/StatusBadge";
import { firstInitial, formatLakhs, whatsappLink } from "@/lib/format";
import { FOLLOW_UP_TYPE_LABELS } from "@/lib/constants";
import { businessDate } from "@/lib/business-time";
import type { FollowUpListItem as FollowUpListItemData } from "@/lib/follow-ups";

const AVATARS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];
function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATARS[Math.abs(hash) % AVATARS.length];
}

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Dedicated, data-richer card for the Staff mobile "My Follow-ups" page
// only (StaffFollowUpsView) -- deliberately NOT a change to
// components/follow-ups/FollowUpListItem.tsx, the shared renderer Admin's
// Follow-ups view, FollowUpsSection and /today still use unchanged. Every
// field shown is a real, already-fetched lead column (lib/follow-ups.ts's
// FollowUpListItem now embeds them) -- no sqft/value is shown for a lead
// that doesn't have one recorded.
export function StaffFollowUpListCard({ followUp }: { followUp: FollowUpListItemData }) {
  const lead = followUp.lead;
  const name = lead?.customer_name || "Unnamed lead";
  const today = businessDate();
  const overdueDays = followUp.status === "pending" ? daysBetween(followUp.due_date, today) : 0;
  const value = lead?.job_value ?? lead?.quotation_amount ?? null;
  const subtitle = [lead?.service_required, lead?.location].filter(Boolean).join(" • ");
  const metaLine = [lead?.estimated_sqft ? `${lead.estimated_sqft} sq.ft` : null, value ? `Est. ${formatLakhs(value)}` : null]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        {followUp.status === "pending" && overdueDays > 0 ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            Overdue by {overdueDays} day{overdueDays === 1 ? "" : "s"}
          </span>
        ) : followUp.status === "pending" && overdueDays === 0 ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            Due today
          </span>
        ) : followUp.status === "pending" ? (
          <span className="text-xs font-medium text-muted-foreground">Due in {Math.abs(overdueDays)} days</span>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">Completed</span>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {lead && <StatusBadge status={lead.status} />}
          {followUp.status === "pending" && (
            <CompleteFollowUpButton followUpId={followUp.id} leadId={followUp.lead_id} />
          )}
        </div>
      </div>

      <Link href={`/leads/${followUp.lead_id}`} className="mt-2 flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarTone(followUp.lead_id)}`}
          aria-hidden="true"
        >
          {firstInitial(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
          {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
          {metaLine && <span className="block truncate text-xs text-muted-foreground">{metaLine}</span>}
          {!lead && <span className="block text-xs text-muted-foreground">{FOLLOW_UP_TYPE_LABELS[followUp.type]} follow-up</span>}
        </span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {lead ? (
          <CallButton
            leadId={followUp.lead_id}
            phone={lead.phone}
            customerName={lead.customer_name}
            leadStatus={lead.status}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-success px-2 text-xs font-semibold text-success-foreground hover:bg-success/90"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
            </svg>
            Call
          </CallButton>
        ) : (
          <span className="flex min-h-11 items-center justify-center rounded-lg bg-muted px-2 text-xs font-semibold text-muted-foreground">Call</span>
        )}
        {lead ? (
          <a
            href={whatsappLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success-soft px-2 text-xs font-semibold text-success hover:bg-success/20"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a8.5 8.5 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            </svg>
            WhatsApp
          </a>
        ) : (
          <span className="flex min-h-11 items-center justify-center rounded-lg bg-muted px-2 text-xs font-semibold text-muted-foreground">WhatsApp</span>
        )}
        <Link
          href={`/leads/${followUp.lead_id}`}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border px-2 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          View
        </Link>
      </div>

      {followUp.notes && <p className="mt-2 truncate text-xs text-muted-foreground">{followUp.notes}</p>}
    </div>
  );
}
