import { notFound } from "next/navigation";
import { LeadForm } from "@/components/LeadForm";
import { updateLead, updateLeadAndNext } from "@/lib/actions/leads";
import { getLeadById } from "@/lib/leads";

export default async function EditLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string; status?: string; campaign?: string; noNext?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-foreground">Edit Lead</h1>
      <p className="mt-1 text-sm text-muted-foreground">{lead.customer_name || lead.phone}</p>
      {sp.noNext === "1" && (
        <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Saved. This is the last lead in your current list — there&apos;s no next lead to advance to.
        </p>
      )}
      <div className="mt-6">
        <LeadForm
          action={updateLead}
          lead={lead}
          submitLabel="Save changes"
          saveAndNextAction={updateLeadAndNext}
          listContext={{ search: sp.search, status: sp.status, campaign: sp.campaign }}
        />
      </div>
    </div>
  );
}
