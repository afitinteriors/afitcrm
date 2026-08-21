import { LeadForm } from "@/components/LeadForm";
import { createLead } from "@/lib/actions/leads";

export default function NewLeadPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-slate-900">New Lead</h1>
      <p className="mt-1 text-sm text-slate-500">Add a lead manually.</p>
      <div className="mt-6">
        <LeadForm action={createLead} submitLabel="Create lead" />
      </div>
    </div>
  );
}
