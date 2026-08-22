import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import type { AuditAction, AuditTargetType, ProfileRole } from "@/lib/supabase/types";

export type AuditLogListItem = {
  id: string;
  created_at: string;
  action: AuditAction;
  target_type: AuditTargetType | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  actor: { display_name: string | null; role: ProfileRole } | null;
};

export type AuditLogFilters = {
  action?: string;
  actorId?: string;
};

const AUDIT_LOG_LIMIT = 200;

export const AUDIT_ACTIONS: AuditAction[] = [
  "login",
  "logout",
  "lead_viewed",
  "lead_created",
  "lead_updated",
  "conversation_viewed",
  "message_sent",
  "audit_log_viewed",
];

function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as string[]).includes(value);
}

// Admin-only in practice: the /audit-log page checks profile.role === "admin"
// before ever calling this, and audit_logs_select_admin_only (RLS) is the
// actual enforcement -- a non-admin caller gets an empty result, not other
// users' data. cache()-wrapped so one request to the page can only ever
// trigger one query and one audit_log_viewed insert, no matter how many
// times this is called during that request.
export const getAuditLogs = cache(async (filters: AuditLogFilters): Promise<AuditLogListItem[]> => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, created_at, action, target_type, target_id, metadata, actor:profiles(display_name, role)")
    .order("created_at", { ascending: false })
    .limit(AUDIT_LOG_LIMIT);

  if (filters.action && isAuditAction(filters.action)) {
    query = query.eq("action", filters.action);
  }
  if (filters.actorId) {
    query = query.eq("actor_id", filters.actorId);
  }

  const { data, error } = await query;
  if (error) return [];

  const logs = (data ?? []) as unknown as AuditLogListItem[];

  // Recorded only for an actual admin view (matches what the RLS-scoped
  // SELECT above really returned) -- fires once, after the read, so it can
  // never appear in the list it just populated.
  if (profile.role === "admin") {
    await recordAuditEvent({ actorId: profile.id, action: "audit_log_viewed" });
  }

  return logs;
});

export type ActorOption = { id: string; display_name: string | null; role: ProfileRole };

export const getActorOptions = cache(async (): Promise<ActorOption[]> => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .order("display_name", { ascending: true });

  if (error) return [];
  return data ?? [];
});
