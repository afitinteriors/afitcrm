import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/leads";
import { getFollowUpsForLead } from "@/lib/follow-ups";
import { getLeadEngagement } from "@/lib/conversations";
import { getQuotationsForLead } from "@/lib/quotations";
import { getCurrentProfile } from "@/lib/auth";
import { Card } from "@/components/Card";
import { StatusSelect } from "@/components/lead-actions/StatusSelect";
import { PipelineStepper } from "@/components/lead-actions/PipelineStepper";
import { LostLeadNotice } from "@/components/lead-actions/ClosedLeadNotice";
import { NextActionCard } from "@/components/lead-actions/NextActionCard";
import { ConversationCard } from "@/components/lead-actions/ConversationCard";
import { AssignmentCard } from "@/components/lead-actions/AssignmentCard";
import { QualificationForm } from "@/components/lead-actions/QualificationForm";
import { QualificationScoreSummary } from "@/components/lead-actions/QualificationScoreCard";
import { SiteVisitForm } from "@/components/lead-actions/SiteVisitForm";
import { SiteVisitDetailsForm } from "@/components/lead-actions/SiteVisitDetailsForm";
import { QuotationManager } from "@/components/lead-actions/QuotationManager";
import { CloseLeadActions } from "@/components/lead-actions/CloseLeadActions";
import { FollowUpsCard } from "@/components/lead-actions/FollowUpsCard";
import { LeadActivity } from "@/components/lead-actions/LeadActivity";
import { DeleteLeadSection } from "@/components/lead-actions/DeleteLeadSection";
import { CallButton } from "@/components/lead-actions/CallButton";
import { formatCurrency, formatDate, formatDateTime, whatsappLink } from "@/lib/format";
import { LEAD_SOURCE_LABELS, LOST_REASON_CATEGORY_LABELS } from "@/lib/constants";
import { getStageSections } from "@/lib/lead-stage-sections";
import { buildLeadsQueryString } from "@/lib/leads";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string; status?: string; campaign?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  // Only ever forwarded, never invented here -- the same list-context query
  // string the lead was opened from (see /leads and LeadRow/LeadCard),
  // carried through to the Edit link so "Save & Next" resolves against the
  // right list.
  const listQuery = buildLeadsQueryString({ search: sp.search, status: sp.status, campaign: sp.campaign });
  const [lead, followUps, engagement, quotations, profile] = await Promise.all([
    getLeadById(id),
    getFollowUpsForLead(id),
    getLeadEngagement(id),
    getQuotationsForLead(id),
    getCurrentProfile(),
  ]);
  if (!lead) notFound();

  // Won's actual closed value takes precedence over the original quote once
  // it exists -- they can legitimately differ (negotiation), and the final
  // number is the more useful one to show at a glance. This is the ONE
  // headline number shown in the contact panel; COMMERCIAL below breaks it
  // down into its two components (job_value, quotation_amount) -- that's
  // detail on the same figure, not a duplicate of it.
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
    // Phase 0a dark-glass surface (CLAUDE.md §2), two-column layout
    // (Blueprint V1 Decisions, 2026-10-31, owner-approved): left column is
    // identity/contact + the actions that touch THIS lead as a record
    // (assignment, next action, close); right column is the work area
    // (overview, follow-ups, stage forms, qualification, conversation).
    <div className="rounded-2xl bg-gradient-dark-bg p-4 sm:p-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-xs font-medium text-surface-foreground-muted hover:text-surface-foreground"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Leads
      </Link>

      {/* PIPELINE STEPPER -- presentational progress indicator, permanent
          (CLAUDE.md "Lead/Pipeline Architecture", superseded 2026-10-31).
          StatusSelect below, in the contact panel, is still the one control
          that actually writes leads.status. */}
      <PipelineStepper status={lead.status} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT -- identity, fast contact actions, assignment, next action,
            and the close-lead actions. Compact: a stack of small cards
            rather than one dense card, so each stays scannable. */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-white/10 bg-glass p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-surface-foreground">
                {initials(lead.customer_name)}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-surface-foreground">
                  {lead.customer_name || "Unnamed lead"}
                </h1>
                <p className="text-sm text-surface-foreground-muted">{lead.phone}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* key={lead.status} forces a remount when status changes via
                  a *different* form (Mark as Won/Lost below) -- StatusSelect's
                  own useState(status) otherwise never re-syncs with a prop
                  update after mount, so the pill would silently show the old
                  stage until a manual reload. Confirmed live during Phase 1
                  verification: job_value updated instantly, the status pill
                  did not, until this fix. */}
              <StatusSelect key={lead.status} leadId={lead.id} status={lead.status} />
              {leadValue !== null && (
                <span className="rounded-full bg-gold px-3 py-1 text-sm font-semibold tabular-nums text-gold-foreground">
                  {formatCurrency(leadValue)}
                </span>
              )}
            </div>

            {(lead.source || lead.location) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {lead.source && (
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-surface-foreground-muted">
                    {LEAD_SOURCE_LABELS[lead.source] ?? lead.source}
                  </span>
                )}
                {lead.location && (
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-surface-foreground-muted">
                    {lead.location}
                  </span>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={whatsappLink(lead.phone)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Message ${lead.customer_name || "lead"} on WhatsApp`}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#25D366] px-3 text-sm font-semibold text-white hover:bg-[#1fbd5a]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.499-.669-.51-.173-.008-.371-.01-.57-.01s-.52.074-.792.372c-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM20.52 3.449C12.831-3.984.194 1.4.192 11.987c0 2.113.55 4.176 1.596 6.006L0 24l6.157-1.611a11.936 11.936 0 005.83 1.485h.005c9.548 0 15.53-10.446 10.53-18.428zM12 21.785h-.004a9.878 9.878 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.245c0-5.462 4.446-9.906 9.913-9.906 2.65 0 5.14 1.032 7.011 2.905a9.83 9.83 0 012.897 6.987C21.933 17.343 17.487 21.785 12 21.785z" />
                </svg>
                WhatsApp
              </a>
              <CallButton
                leadId={lead.id}
                phone={lead.phone}
                customerName={lead.customer_name}
                leadStatus={lead.status}
                aria-label={`Call ${lead.customer_name || "lead"}`}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/15 px-3 text-sm font-medium text-surface-foreground hover:bg-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
                </svg>
                Call
              </CallButton>
            </div>
            <Link
              href={listQuery ? `/leads/${lead.id}/edit?${listQuery}` : `/leads/${lead.id}/edit`}
              className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md text-sm font-medium text-surface-foreground-muted hover:bg-white/10 hover:text-surface-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.932Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Edit lead
            </Link>
          </div>

          <AssignmentCard leadId={lead.id} assignedToId={lead.assigned_to_id} createdAt={lead.created_at} />

          {/* NEXT ACTION -- answers "what should I do now?" on its own,
              instead of as a small link buried in the header. */}
          <NextActionCard leadId={lead.id} nextFollowUp={nextFollowUp} />

          {/* CLOSE LEAD -- the only path to Won/Lost (Phase 3, CLAUDE.md §5):
              Won needs a commercial number to exist first, so it's only
              offered from Quotation/Negotiation onward (CloseLeadActions'
              own canMarkWon() check) -- winning a brand-new lead makes no
              business sense. Lost has no such constraint, so it's always
              reachable while the lead is open. Once actually closed, this
              becomes a plain read-out instead of action buttons -- but
              #close-lead itself always exists so StatusSelect's redirect
              (see that component) always has somewhere to scroll to. */}
          <div id="close-lead" className="rounded-xl border border-white/10 bg-glass p-4 backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-surface-foreground">Close lead</h2>
            {lead.status === "won" && (
              <p className="mt-2 text-sm text-surface-foreground-muted">
                Won
                {lead.job_value !== null && (
                  <>
                    {" · "}
                    <span className="font-medium text-surface-foreground">{formatCurrency(lead.job_value)}</span>
                  </>
                )}
                {lead.advance_proof_reference && (
                  <>
                    {" · advance: "}
                    <span className="font-medium text-surface-foreground">{lead.advance_proof_reference}</span>
                  </>
                )}
              </p>
            )}
            {lead.status === "lost" && (lead.lost_reason_category || lead.lost_reason) && (
              <p className="mt-2 text-sm text-surface-foreground-muted">
                Currently marked lost:{" "}
                <span className="text-surface-foreground">
                  {lead.lost_reason_category ? LOST_REASON_CATEGORY_LABELS[lead.lost_reason_category] : null}
                  {lead.lost_reason_category && lead.lost_reason ? " — " : null}
                  {lead.lost_reason}
                </span>
              </p>
            )}

            <div className="mt-3">
              {lead.status === "lost" ? (
                <LostLeadNotice />
              ) : (
                <CloseLeadActions
                  // key={lead.status}: same remount-on-status-change idiom
                  // as StatusSelect above -- a successful markLeadWon()
                  // revalidates the page with a new status, and this
                  // component's own openModal state would otherwise survive
                  // that refresh, leaving the confirm modal open over data
                  // that already shows the lead as closed.
                  key={lead.status}
                  leadId={lead.id}
                  customerName={lead.customer_name}
                  status={lead.status}
                  jobValue={lead.job_value}
                  advanceProofReference={lead.advance_proof_reference}
                  lostReason={lead.lost_reason}
                  lostReasonCategory={lead.lost_reason_category}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT -- the work area: requirement/overview, follow-ups,
            stage-gated forms (Site Visit/Quotation), qualification,
            commercial, conversation. QUALIFICATION/COMMERCIAL stay gated by
            stage (Phase 3, CLAUDE.md §5): a brand-new lead has no quotation
            to speak of, so it doesn't see a Quotation form or a Commercial
            card, only Qualification. */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Overview" variant="glass">
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
              <div className="mt-4 rounded-md border-l-2 border-white/15 bg-white/5 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-foreground-muted">
                  Original WhatsApp message
                </p>
                <p className="mt-1 text-sm text-surface-foreground">{lead.whatsapp_message}</p>
              </div>
            )}

            <details className="group mt-4">
              <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-surface-foreground-muted marker:hidden hover:text-surface-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
                More details
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-3 sm:grid-cols-3 lg:grid-cols-4">
                <Info label="Source" value={LEAD_SOURCE_LABELS[lead.source ?? ""] ?? lead.source} />
                <Info label="Meta campaign" value={lead.campaign_name} />
                <Info label="Ad set" value={lead.adset_name} />
                <Info label="Ad" value={lead.ad_name} />
                <Info label="Created" value={formatDateTime(lead.created_at)} />
              </dl>
            </details>
          </Card>

          <div id="follow-ups">
            <FollowUpsCard leadId={lead.id} followUps={followUps} />
          </div>

          {sections.has("siteVisit") && (
            <Card title="Site Visit" variant="glass">
              <p className="mb-3 text-sm text-surface-foreground-muted">
                Current: <span className="font-medium text-surface-foreground">{formatDateTime(lead.site_visit_date)}</span>
              </p>
              <SiteVisitForm leadId={lead.id} siteVisitDate={lead.site_visit_date} />
              <p className="mt-2 text-xs text-surface-foreground-muted">Recording a date here does not change the pipeline stage.</p>
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="mb-3 text-sm font-medium text-surface-foreground">Visit done</p>
                <SiteVisitDetailsForm
                  leadId={lead.id}
                  measurements={lead.site_visit_measurements}
                  photoReference={lead.site_visit_photo_reference}
                />
              </div>
            </Card>
          )}

          {sections.has("quotation") && (
            <Card title="Quotation" variant="glass">
              {/* key={quotations[0]?.id ?? "new"}: remounts QuotationManager
                  (resetting its draft form/SubmitButton state) whenever the
                  latest version actually changes -- a new version created,
                  or the current one flips draft -> sent -- same idiom as
                  CloseLeadActions' key={lead.status} above. */}
              <QuotationManager
                key={quotations[0]?.id ?? "new"}
                leadId={lead.id}
                quotations={quotations}
                isAdmin={profile?.role === "admin"}
              />
              <p className="mt-2 text-xs text-surface-foreground-muted">
                R-QUOTE-001: a sent quotation is locked -- a change creates a new version. Saving here does not change the pipeline
                stage; the current amount is shown under Commercial.
              </p>
            </Card>
          )}

          {sections.has("qualification") && (
            <Card title="Qualification" variant="glass">
              <QualificationScoreSummary lead={lead} followUps={followUps} engagement={engagement} />

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-foreground-muted">Staff assessment</p>
                <p className="mb-3 mt-1 text-sm text-surface-foreground-muted">
                  Score: <span className="font-medium text-surface-foreground">{lead.qualification_score ?? "—"}</span>
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
            <Card title="Commercial" variant="glass">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Info label="Job value" value={lead.job_value !== null ? formatCurrency(lead.job_value) : null} />
                <Info label="Quotation amount" value={lead.quotation_amount !== null ? formatCurrency(lead.quotation_amount) : null} />
              </dl>
            </Card>
          )}

          <ConversationCard leadId={lead.id} />
        </div>
      </div>

      {/* ACTIVITY -- admin-only (LeadActivity itself checks the role and
          renders nothing for staff/no history, own margin included so an
          empty result doesn't leave a blank gap); a distinct section rather
          than nested inside either column so it reads as meta/audit info,
          not a task. */}
      <LeadActivity leadId={lead.id} />

      <DeleteLeadSection leadId={lead.id} customerName={lead.customer_name} phone={lead.phone} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-surface-foreground-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-surface-foreground">{value || "—"}</dd>
    </div>
  );
}
