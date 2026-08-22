import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AuditAction, AuditTargetType } from "@/lib/supabase/types";

type RecordAuditEventInput = {
  actorId: string;
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

// Fail-open by design: audit logging must never block or fail the primary
// operation it describes. RLS (audit_logs_select_admin_only /
// audit_logs_insert_self) is the actual security boundary on this table --
// this function succeeding or failing doesn't change whether the action it
// records was authorized.
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: input.actorId,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      metadata: input.metadata ?? null,
    });

    if (error) {
      console.error(`Failed to record audit event (${input.action}):`, error.message);
    }
  } catch (err) {
    console.error(`Unexpected error recording audit event (${input.action}):`, err);
  }
}
