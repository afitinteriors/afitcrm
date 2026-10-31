import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { sendDedupedAlert } from "@/lib/rules/alert";
import type { StageTrackedLead } from "@/lib/rules/stage-timer";

export type StageAlertBucket = "staff" | "owner";

function leadLabel(lead: StageTrackedLead): string {
  return lead.customer_name?.trim() || lead.phone;
}

const BUCKET_COPY: Record<StageAlertBucket, { type: string; title: (stage: string) => string }> = {
  staff: {
    type: "lead.stage_overdue_staff",
    title: (stage) => `${stage} is overdue`,
  },
  owner: {
    type: "lead.stage_overdue_owner",
    title: (stage) => `${stage} still overdue`,
  },
};

// R-STAGE-002 (docs/BLUEPRINT_V1.md Section 8). Same "staff, then owner"
// shape as R-LEAD-003's sendResponseAlerts -- the dedupe key includes the
// lead's status so a lead that later becomes overdue again in a DIFFERENT
// stage gets its own fresh alert instead of being silently suppressed by an
// earlier stage's dedupe row.
export async function sendStageAlerts(
  admin: SupabaseClient<Database>,
  leads: StageTrackedLead[],
  recipientIds: (lead: StageTrackedLead) => string[],
  bucket: StageAlertBucket,
): Promise<void> {
  const copy = BUCKET_COPY[bucket];

  await Promise.all(
    leads.flatMap((lead) => {
      const stage = LEAD_STATUS_LABELS[lead.status];
      return recipientIds(lead).map((userId) =>
        sendDedupedAlert(admin, {
          userId,
          entityId: lead.id,
          dedupeKey: `lead-stage-${bucket}:${lead.id}:${lead.status}`,
          type: copy.type,
          title: copy.title(stage),
          body: `${leadLabel(lead)} has been in ${stage} past its time limit.`,
          route: `/leads/${lead.id}`,
        }),
      );
    }),
  );
}
