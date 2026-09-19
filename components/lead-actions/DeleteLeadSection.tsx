import { getCurrentProfile } from "@/lib/auth";
import { DeleteLeadButton } from "@/components/lead-actions/DeleteLeadButton";

// Admin-only, same "hide, don't gate" convention as LeadActivity --
// leads_delete_admin_only (RLS) is the actual enforced boundary; this is
// convenience visibility only. A staff request never even receives the
// button, let alone a working form.
export async function DeleteLeadSection({
  leadId,
  customerName,
  phone,
}: {
  leadId: string;
  customerName: string | null;
  phone: string;
}) {
  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return null;

  return (
    <div className="mt-8 border-t border-danger/30 pt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-danger">Danger Zone</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently delete this lead, its conversation, messages, and follow-ups. This cannot be undone.
      </p>
      <div className="mt-3">
        <DeleteLeadButton leadId={leadId} customerName={customerName} phone={phone} />
      </div>
    </div>
  );
}
