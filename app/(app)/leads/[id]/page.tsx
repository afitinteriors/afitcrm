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
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            WhatsApp
          </a>
          <a
            href={telLink(lead.phone)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Call
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
