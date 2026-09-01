import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { ServiceRow, ServiceKeywordRow, AutomationRow, AutomationRunRow, AutomationMediaRow } from "@/lib/supabase/types";

export type ServiceWithConfig = ServiceRow & {
  keywords: ServiceKeywordRow[];
  automation: AutomationRow | null;
};

// Admin-only -- mirrors getAssignableStaff()'s "return [] for a non-admin
// caller" pattern. RLS (services/service_keywords/automations
// _select_admin_only) already enforces this independently; this is an
// explicit short-circuit so a non-admin caller never even issues the
// queries, not the actual security boundary.
export async function getServicesWithConfig(): Promise<ServiceWithConfig[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();

  const [
    { data: services, error: servicesError },
    { data: keywords, error: keywordsError },
    { data: automations, error: automationsError },
  ] = await Promise.all([
    supabase.from("services").select("*").order("name", { ascending: true }),
    supabase.from("service_keywords").select("*").order("priority", { ascending: true }),
    supabase.from("automations").select("*"),
  ]);

  if (servicesError || keywordsError || automationsError) {
    throw new Error(
      servicesError?.message ?? keywordsError?.message ?? automationsError?.message ?? "Failed to load automation configuration."
    );
  }

  return (services ?? []).map((service) => ({
    ...service,
    keywords: (keywords ?? []).filter((k) => k.service_id === service.id),
    automation: (automations ?? []).find((a) => a.service_id === service.id) ?? null,
  }));
}

const RECENT_RUNS_LIMIT = 50;

export type AutomationRunWithConversation = AutomationRunRow & {
  conversationWaId: string | null;
};

// Read-only visibility into automation_runs -- every inbound message that
// reaches triggerAutomationForMessage() (lib/automations/trigger.ts) has
// already been writing a row here since Phase 2, but nothing in the UI has
// ever displayed it: an admin has had no way to tell whether a service's
// automation actually matched/ran/failed without querying the database
// directly. Scoped by matched_service_id (set independently of whether an
// automation_id ended up populated -- covers matched, no_match-with-
// service, and failed rows alike), most recent first, capped at
// RECENT_RUNS_LIMIT -- a bounded recent-activity view, not a paginated
// archive; this phase adds visibility into existing data, not a new
// reporting feature.
export async function getAutomationRunsForService(serviceId: string): Promise<AutomationRunWithConversation[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();

  const { data: runs, error: runsError } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("matched_service_id", serviceId)
    .order("created_at", { ascending: false })
    .limit(RECENT_RUNS_LIMIT);

  if (runsError) {
    throw new Error(runsError.message);
  }
  if (!runs || runs.length === 0) return [];

  const conversationIds = Array.from(new Set(runs.map((r) => r.conversation_id)));
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id, wa_id")
    .in("id", conversationIds);

  if (conversationsError) {
    throw new Error(conversationsError.message);
  }

  const waIdByConversationId = new Map((conversations ?? []).map((c) => [c.id, c.wa_id]));

  return runs.map((run) => ({
    ...run,
    conversationWaId: waIdByConversationId.get(run.conversation_id) ?? null,
  }));
}

// Read layer for the builder's media picker (send_image/send_video node
// config). Media MVP, approved architecture -- flat list, no
// folders/tags/search/pagination, matching the deliberately minimal scope.
export async function getAutomationMediaAssets(): Promise<AutomationMediaRow[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("automation_media")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
}
