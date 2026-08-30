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

const LEAD_ACTIVITY_LIMIT = 20;

// Same audit_logs table and same audit_logs_select_admin_only RLS as
// getAuditLogs -- just scoped to one lead's target_id instead of the whole
// log, so a staff caller gets an empty array here too (RLS is the real
// boundary; the Lead Detail page additionally only renders this section for
// profile.role === "admin", matching the SidebarAdminNav "hide, don't gate"
// pattern used elsewhere). No new table, no new query shape, no audit_log_viewed
// side effect -- this isn't "viewing the audit log", it's per-lead context.
//
// Excludes lead_viewed: getLeadById() records one on every single page load,
// so an active lead accumulates dozens of them and they'd drown out every
// event that actually describes something happening to the lead. That raw
// view trail is still fully available on the admin /audit-log page (which
// this function and its RLS don't touch) -- this is a curated "what
// happened" timeline, not a duplicate access log.
export const getLeadActivity = cache(async (leadId: string): Promise<AuditLogListItem[]> => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, created_at, action, target_type, target_id, metadata, actor:profiles(display_name, role)")
    .eq("target_type", "lead")
    .eq("target_id", leadId)
    .neq("action", "lead_viewed")
    .order("created_at", { ascending: false })
    .limit(LEAD_ACTIVITY_LIMIT);

  if (error) return [];
  return (data ?? []) as unknown as AuditLogListItem[];
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
