import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/leads";
import { getFollowUpsForLead } from "@/lib/follow-ups";
import { getLeadEngagement } from "@/lib/conversations";
import { Card } from "@/components/Card";
import { StatusSelect } from "@/components/lead-actions/StatusSelect";
import { NextActionCard } from "@/components/lead-actions/NextActionCard";
import { ConversationCard } from "@/components/lead-actions/ConversationCard";
import { AssignmentCard } from "@/components/lead-actions/AssignmentCard";
import { QualificationForm } from "@/components/lead-actions/QualificationForm";
import { QualificationScoreSummary } from "@/components/lead-actions/QualificationScoreCard";
import { SiteVisitForm } from "@/components/lead-actions/SiteVisitForm";
import { QuotationForm } from "@/components/lead-actions/QuotationForm";
import { MarkLostForm, MarkWonForm } from "@/components/lead-actions/WonLostForms";
import { FollowUpsCard } from "@/components/lead-actions/FollowUpsCard";
import { LeadActivity } from "@/components/lead-actions/LeadActivity";
import { formatCurrency, formatDate, formatDateTime, telLink, whatsappLink } from "@/lib/format";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { getStageSections, canMarkWon } from "@/lib/lead-stage-sections";

export default async function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const [lead, followUps, engagement] = await Promise.all([
    getLeadById(id),
    getFollowUpsForLead(id),
    getLeadEngagement(id),
  ]);
  if (!lead) notFound();

  // Won's actual closed value takes precedence over the original quote once
  // it exists -- they can legitimately differ (negotiation), and the final
  // number is the more useful one to show at a glance. This is the ONE
  // headline number shown in the header; COMMERCIAL below breaks it down
  // into its two components (job_value, quotation_amount) -- that's detail
  // on the same figure, not a duplicate of it.
  const leadValue = lead.job_value ?? lead.quotation_amount;

  // followUps is already sorted soonest-first (getFollowUpsForLead), so the
  // first pending one is the next thing to do -- no extra query or sort.
  const nextFollowUp = followUps.find((f) => f.status === "pending") ?? null;

  // Phase 3 (CLAUDE.md §5): which of the stage-dependent sections apply to
  // THIS lead's current stage. Header/Next Action/Overview/Follow-ups/
  // Conversation/Assigned-to/Activity are relevant at every stage and are
  // not gated -- only Qualification/Site Visit/Quotation/Commercial vary.
  const sections = getStageSections(lead.status);

  return (
    <div>
      {/* HEADER -- who, current pipeline stage, lead value, contact actions.
          Answers questions 1, 2, 4, 5 of the "first screen" checklist. */}
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Leads
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{lead.customer_name || "Unnamed lead"}</h1>
            {/* key={lead.status} forces a remount when status changes via a
                *different* form (Mark as Won/Lost below) -- StatusSelect's
                own useState(status) otherwise never re-syncs with a prop
                update after mount, so the pill would silently show the old
                stage until a manual reload. Confirmed live during Phase 1
                verification: job_value updated instantly, the status pill
                did not, until this fix. */}
            <StatusSelect key={lead.status} leadId={lead.id} status={lead.status} />
            {leadValue !== null && (
              <span className="rounded-full border border-border px-3 py-1 text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(leadValue)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{lead.phone}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href={whatsappLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Message ${lead.customer_name || "lead"} on WhatsApp`}
            className="flex h-11 items-center gap-2 rounded-md bg-[#25D366] px-4 text-sm font-semibold text-white hover:bg-[#1fbd5a]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.499-.669-.51-.173-.008-.371-.01-.57-.01s-.52.074-.792.372c-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM20.52 3.449C12.831-3.984.194 1.4.192 11.987c0 2.113.55 4.176 1.596 6.006L0 24l6.157-1.611a11.936 11.936 0 005.83 1.485h.005c9.548 0 15.53-10.446 10.53-18.428zM12 21.785h-.004a9.878 9.878 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.245c0-5.462 4.446-9.906 9.913-9.906 2.65 0 5.14 1.032 7.011 2.905a9.83 9.83 0 012.897 6.987C21.933 17.343 17.487 21.785 12 21.785z" />
            </svg>
            WhatsApp
          </a>
          <a
            href={telLink(lead.phone)}
            aria-label={`Call ${lead.customer_name || "lead"}`}
            className="flex h-11 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
            </svg>
            Call
          </a>
          <Link
            href={`/leads/${lead.id}/edit`}
            aria-label="Edit lead"
            title="Edit lead"
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.932Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
          </Link>
        </div>
      </div>

      {/* NEXT ACTION -- answers question 3 ("what should I do now?") on its
          own, instead of as a small link buried in the header. */}
      <div className="mt-6">
        <NextActionCard leadId={lead.id} nextFollowUp={nextFollowUp} />
      </div>

      {/* OVERVIEW -- requirement first (what they want), then location, then
          the original enquiry. Marketing/attribution metadata (source,
          campaign, ad, created date) is real but not part of what a staff
          member needs to answer the first-screen questions, so it's tucked
          behind "More details" rather than competing for the same space. */}
      <div className="mt-6">
        <Card title="Overview">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <Info label="Project type" value={lead.project_type} />
            <Info label="Service required" value={lead.service_required} />
            <Info
              label="Estimated sq. ft."
              value={lead.estimated_sqft ? String(lead.estimated_sqft) : null}
            />
            <Info label="Expected start date" value={formatDate(lead.expected_start_date)} />
            <Info label="Location" value={lead.location} />
          </dl>

          {lead.whatsapp_message && (
            <div className="mt-4 rounded-md border-l-2 border-border bg-muted px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Original WhatsApp message
              </p>
              <p className="mt-1 text-sm text-foreground">{lead.whatsapp_message}</p>
            </div>
          )}

          <details className="group mt-4">
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-muted-foreground marker:hidden hover:text-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              More details
            </summary>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-3 sm:grid-cols-3 lg:grid-cols-4">
              <Info label="Source" value={LEAD_SOURCE_LABELS[lead.source ?? ""] ?? lead.source} />
              <Info label="Meta campaign" value={lead.campaign_name} />
              <Info label="Ad set" value={lead.adset_name} />
              <Info label="Ad" value={lead.ad_name} />
              <Info label="Created" value={formatDateTime(lead.created_at)} />
            </dl>
          </details>
        </Card>
      </div>

      {/* WORK (primary, left) -- everything a staff member does to move the
          lead forward. QUALIFICATION / COMMERCIAL (secondary, right) --
          gated by stage (Phase 3, CLAUDE.md §5): a brand-new lead has no
          quotation to speak of, so it doesn't see a Quotation form or a
          Commercial card, only Qualification. Each figure still has
          exactly one display owner: Commercial is the only place
          job_value/quotation_amount are shown; the Quotation card under
          WORK is only the *form* that sets the amount. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2" id="follow-ups">
          <FollowUpsCard leadId={lead.id} followUps={followUps} />

          {sections.has("siteVisit") && (
            <Card title="Site Visit">
              <p className="mb-3 text-sm text-muted-foreground">
                Current: <span className="font-medium text-foreground">{formatDateTime(lead.site_visit_date)}</span>
              </p>
              <SiteVisitForm leadId={lead.id} siteVisitDate={lead.site_visit_date} />
              <p className="mt-2 text-xs text-muted-foreground">Recording a date here does not change the pipeline stage.</p>
            </Card>
          )}

          {sections.has("quotation") && (
            <Card title="Quotation">
              <QuotationForm leadId={lead.id} quotationAmount={lead.quotation_amount} />
              <p className="mt-2 text-xs text-muted-foreground">
                Recording an amount here does not change the pipeline stage. The current amount is shown under Commercial.
              </p>
            </Card>
          )}

          <ConversationCard leadId={lead.id} />
        </div>

        <div className="space-y-6">
          <AssignmentCard leadId={lead.id} assignedToId={lead.assigned_to_id} />

          {sections.has("qualification") && (
            <Card title="Qualification">
              <QualificationScoreSummary lead={lead} followUps={followUps} engagement={engagement} />

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Staff assessment</p>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">
                  Score: <span className="font-medium text-foreground">{lead.qualification_score ?? "—"}</span>
                </p>
                <QualificationForm
                  leadId={lead.id}
                  score={lead.qualification_score}
                  notes={lead.qualification_notes}
                />
              </div>
            </Card>
          )}

          {sections.has("commercial") && (
            <Card title="Commercial">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Info label="Job value" value={lead.job_value !== null ? formatCurrency(lead.job_value) : null} />
                <Info label="Quotation amount" value={lead.quotation_amount !== null ? formatCurrency(lead.quotation_amount) : null} />
              </dl>
            </Card>
          )}
        </div>
      </div>

      {/* ACTIVITY -- admin-only (LeadActivity itself checks the role and
          renders nothing for staff/no history, own margin included so an
          empty result doesn't leave a blank gap); a distinct section rather
          than nested inside WORK so it reads as meta/audit info, not a task. */}
      <LeadActivity leadId={lead.id} />

      {/* CLOSE LEAD -- the only path to Won/Lost, gated by stage (Phase 3,
          CLAUDE.md §5): Won needs a commercial number to exist first, so
          it's only offered from Quotation/Negotiation onward -- winning a
          brand-new lead makes no business sense. Lost has no such
          constraint (a lead can go cold at any open stage), so
          MarkLostForm is always available while the lead is still open.
          Once actually closed, this becomes a plain read-out instead of a
          form -- "Mark Won/Lost" isn't a permanently-visible action, but
          #close-lead itself always exists so StatusSelect's redirect (see
          that component) always has somewhere to open/scroll to. */}
      <div className="mt-8 border-t border-border pt-6">
        {lead.status === "won" && (
          <p className="text-sm text-muted-foreground">
            Won
            {lead.job_value !== null && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{formatCurrency(lead.job_value)}</span>
              </>
            )}
          </p>
        )}
        {lead.status === "lost" && lead.lost_reason && (
          <p className="text-sm text-muted-foreground">
            Currently marked lost: <span className="text-foreground">{lead.lost_reason}</span>
          </p>
        )}

        {lead.status === "lost" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            To reconsider this lead, move it to an earlier pipeline stage using the stage selector above.
          </p>
        ) : (
          <details id="close-lead" className={`group ${lead.status === "won" ? "mt-3" : ""}`}>
            <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-foreground marker:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              {lead.status === "won" ? "Correct to Lost" : "Mark Won / Lost"}
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {canMarkWon(lead.status) && <MarkWonForm leadId={lead.id} jobValue={lead.job_value} />}
              <MarkLostForm leadId={lead.id} lostReason={lead.lost_reason} />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}
