import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/leads";
import { getFollowUpsForLead } from "@/lib/follow-ups";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/Card";
import { StatusSelect } from "@/components/lead-actions/StatusSelect";
import { QualificationForm } from "@/components/lead-actions/QualificationForm";
import { SiteVisitForm } from "@/components/lead-actions/SiteVisitForm";
import { QuotationForm } from "@/components/lead-actions/QuotationForm";
import { JobValueForm } from "@/components/lead-actions/JobValueForm";
import { MarkLostForm, MarkWonForm } from "@/components/lead-actions/WonLostForms";
import { FollowUpsCard } from "@/components/lead-actions/FollowUpsCard";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  telLink,
  whatsappLink,
} from "@/lib/format";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";

export default async function LeadDetailPage({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const [lead, followUps] = await Promise.all([getLeadById(id), getFollowUpsForLead(id)]);
  if (!lead) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/leads" className="text-xs font-medium text-slate-500 hover:text-slate-700">
            ← Back to leads
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {lead.customer_name || "Unnamed lead"}
            </h1>
            <StatusBadge status={lead.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={whatsappLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Message ${lead.customer_name || "lead"} on WhatsApp`}
            title="Message on WhatsApp"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-[#25D366] hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.499-.669-.51-.173-.008-.371-.01-.57-.01s-.52.074-.792.372c-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM20.52 3.449C12.831-3.984.194 1.4.192 11.987c0 2.113.55 4.176 1.596 6.006L0 24l6.157-1.611a11.936 11.936 0 005.83 1.485h.005c9.548 0 15.53-10.446 10.53-18.428zM12 21.785h-.004a9.878 9.878 0 01-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.245c0-5.462 4.446-9.906 9.913-9.906 2.65 0 5.14 1.032 7.011 2.905a9.83 9.83 0 012.897 6.987C21.933 17.343 17.487 21.785 12 21.785z" />
            </svg>
          </a>
          <a
            href={telLink(lead.phone)}
            aria-label={`Call ${lead.customer_name || "lead"}`}
            title="Call"
            className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
            </svg>
          </a>
          <Link
            href={`/leads/${lead.id}/edit`}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Lead information">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Info label="Phone" value={lead.phone} />
              <Info label="Location" value={lead.location} />
              <Info label="Project type" value={lead.project_type} />
              <Info label="Service required" value={lead.service_required} />
              <Info
                label="Estimated sq. ft."
                value={lead.estimated_sqft ? String(lead.estimated_sqft) : null}
              />
              <Info label="Expected start date" value={formatDate(lead.expected_start_date)} />
              <Info label="Source" value={LEAD_SOURCE_LABELS[lead.source ?? ""] ?? lead.source} />
              <Info label="Assigned to" value={lead.assigned_to} />
              <Info label="Meta campaign" value={lead.campaign_name} />
              <Info label="Ad set" value={lead.adset_name} />
              <Info label="Ad" value={lead.ad_name} />
              <Info label="Created" value={formatDateTime(lead.created_at)} />
            </dl>
          </Card>

          {lead.whatsapp_message && (
            <Card title="WhatsApp message">
              <p className="whitespace-pre-wrap text-sm text-slate-700">{lead.whatsapp_message}</p>
            </Card>
          )}

          <Card title="Qualification">
            <div className="mb-4 flex gap-6 text-sm text-slate-600">
              <span>
                Score: <span className="font-medium text-slate-900">{lead.qualification_score ?? "—"}</span>
              </span>
            </div>
            <QualificationForm
              leadId={lead.id}
              score={lead.qualification_score}
              notes={lead.qualification_notes}
            />
          </Card>

          {lead.status === "lost" && lead.lost_reason && (
            <Card title="Lost reason">
              <p className="text-sm text-slate-700">{lead.lost_reason}</p>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <StatusSelect leadId={lead.id} status={lead.status} />
          </Card>

          <FollowUpsCard leadId={lead.id} followUps={followUps} />

          <Card title="Site visit">
            <p className="mb-3 text-sm text-slate-600">
              Current: <span className="font-medium text-slate-900">{formatDateTime(lead.site_visit_date)}</span>
            </p>
            <SiteVisitForm leadId={lead.id} siteVisitDate={lead.site_visit_date} />
          </Card>

          <Card title="Quotation">
            <p className="mb-3 text-sm text-slate-600">
              Current: <span className="font-medium text-slate-900">{formatCurrency(lead.quotation_amount)}</span>
            </p>
            <QuotationForm leadId={lead.id} quotationAmount={lead.quotation_amount} />
          </Card>

          <Card title="Job value">
            <p className="mb-3 text-sm text-slate-600">
              Current: <span className="font-medium text-slate-900">{formatCurrency(lead.job_value)}</span>
            </p>
            <JobValueForm leadId={lead.id} jobValue={lead.job_value} />
          </Card>

          <Card title="Mark won">
            <MarkWonForm leadId={lead.id} jobValue={lead.job_value} />
          </Card>

          <Card title="Mark lost">
            <MarkLostForm leadId={lead.id} lostReason={lead.lost_reason} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}
