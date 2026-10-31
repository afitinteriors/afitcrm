import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendDedupedAlert } from "@/lib/rules/alert";
import type { UnrespondedLead } from "@/lib/rules/response-timer";

export type AlertBucket = "staff" | "owner";

const BUCKET_COPY: Record<AlertBucket, { type: string; title: string; body: (label: string) => string }> = {
  staff: {
    type: "lead.response_overdue_staff",
    title: "Lead waiting 15+ minutes",
    body: (label) => `${label} has had no response yet.`,
  },
  owner: {
    type: "lead.response_overdue_owner",
    title: "Lead waiting 30+ minutes",
    body: (label) => `${label} still has no response.`,
  },
};

function leadLabel(lead: UnrespondedLead): string {
  return lead.customer_name?.trim() || lead.phone;
}

// R-LEAD-003 (docs/BLUEPRINT_V1.md Section 8): "staff at 15 min, owner at 30
// min." `recipientIds` is the route handler's call: the lead's assigned
// staff for the 15-min bucket (falling back to every admin when the lead is
// unassigned -- there is no staff member to alert), always every admin for
// the 30-min bucket.
export async function sendResponseAlerts(
  admin: SupabaseClient<Database>,
  leads: UnrespondedLead[],
  recipientIds: (lead: UnrespondedLead) => string[],
  bucket: AlertBucket,
): Promise<void> {
  const copy = BUCKET_COPY[bucket];

  await Promise.all(
    leads.flatMap((lead) =>
      recipientIds(lead).map((userId) =>
        sendDedupedAlert(admin, {
          userId,
          entityId: lead.id,
          dedupeKey: `lead-response-${bucket}:${lead.id}`,
          type: copy.type,
          title: copy.title,
          body: copy.body(leadLabel(lead)),
          route: `/leads/${lead.id}`,
        }),
      ),
    ),
  );
}
