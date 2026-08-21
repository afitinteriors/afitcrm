import { notFound } from "next/navigation";
import { LeadForm } from "@/components/LeadForm";
import { updateLead } from "@/lib/actions/leads";
import { getLeadById } from "@/lib/leads";

export default async function EditLeadPage({ params }: PageProps<"/leads/[id]/edit">) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">Edit Lead</h1>
      <p className="mt-1 text-sm text-slate-500">{lead.customer_name || lead.phone}</p>
      <div className="mt-6">
        <LeadForm action={updateLead} lead={lead} submitLabel="Save changes" />
      </div>
    </div>
  );
}
