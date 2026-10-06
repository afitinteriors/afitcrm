"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { parseBuilderGraph, validateBuilderGraph, BuilderGraphError } from "@/lib/automations/builder-graph";

export type ActionState = { error: string } | null;

// Admin-only for every mutation here -- services/service_keywords/
// automations RLS already enforces this independently (admin-only CRUD
// policies from the Phase 1 migration); this is the same explicit
// application-level check used throughout this app (e.g. assignLead()),
// not a substitute for it.
async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function revalidateServicesPage() {
  revalidatePath("/automation/services");
}

export async function createService(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Admin access required." };

  const name = str(formData, "name");
  if (!name) return { error: "Service name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({ name });
  if (error) return { error: error.message };

  revalidateServicesPage();
  return null;
}

export async function toggleServiceActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Admin access required." };

  const serviceId = str(formData, "service_id");
  const isActive = str(formData, "is_active") === "true";
  if (!serviceId) return { error: "Missing service." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", serviceId);
  if (error) return { error: error.message };

  revalidateServicesPage();
  return null;
}

export async function addKeyword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Admin access required." };

  const serviceId = str(formData, "service_id");
  const keyword = str(formData, "keyword");
  const priorityRaw = str(formData, "priority");
  const priority = priorityRaw ? Number(priorityRaw) : 0;

  if (!serviceId || !keyword) return { error: "Keyword text is required." };
  if (!Number.isFinite(priority)) return { error: "Priority must be a number." };

  const supabase = await createClient();
  const { error } = await supabase.from("service_keywords").insert({ service_id: serviceId, keyword, priority });

  if (error) {
    if (error.code === "23505") return { error: "This keyword is already active for this service." };
    return { error: error.message };
  }

  revalidateServicesPage();
  return null;
}

export async function toggleKeywordActive(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Admin access required." };

  const keywordId = str(formData, "keyword_id");
  const isActive = str(formData, "is_active") === "true";
  if (!keywordId) return { error: "Missing keyword." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_keywords")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", keywordId);

  if (error) {
    if (error.code === "23505") return { error: "Another active keyword with this text already exists for this service." };
    return { error: error.message };
  }

  revalidateServicesPage();
  return null;
}

export async function deleteKeyword(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await requireAdmin())) return { error: "Admin access required." };

  const keywordId = str(formData, "keyword_id");
  if (!keywordId) return { error: "Missing keyword." };

  const supabase = await createClient();
  const { error } = await supabase.from("service_keywords").delete().eq("id", keywordId);
  if (error) return { error: error.message };

  revalidateServicesPage();
  return null;
}

// Exactly one automation per service, created lazily the first time an
// admin saves a flow for it in the builder -- matches "the active
// automation for a service" (singular). The DB's own partial unique index
// (automations_one_active_per_service_idx, service_id WHERE status =
// 'active') is the real enforcement; passing the existing automation_id
// whenever one exists (never inserting a second row for an
// already-configured service) is what keeps this Server Action from ever
// tripping it under normal use.
//
// Builder safety (Automation Builder UI phase): this action never writes
// status 'active'. The client's is_active value is not read at all, so a
// stale or hand-built request cannot activate a flow. A flow already marked
// active is refused rather than edited, because changing a live graph would
// change live behaviour. "publish" only validates and stamps the graph with
// meta.publishedAt -- it does not enable anything.
export type SaveAutomationState = { error: string } | { automationId: string; publishedAt: string | null } | null;

export async function saveAutomationGraph(
  _prevState: SaveAutomationState,
  formData: FormData
): Promise<SaveAutomationState> {
  if (!(await requireAdmin())) return { error: "Admin access required." };

  const serviceId = str(formData, "service_id");
  const automationId = str(formData, "automation_id");
  const mode = str(formData, "mode") === "publish" ? "publish" : "draft";
  const graphJson = str(formData, "graph");
  const flowName = str(formData, "flow_name") || "Default automation";
  if (flowName.length > 80) return { error: "Flow name must be 80 characters or fewer." };

  if (!serviceId) return { error: "Missing service." };

  let graph;
  try {
    graph = parseBuilderGraph(JSON.parse(graphJson));
  } catch (err) {
    if (err instanceof BuilderGraphError) return { error: err.message };
    return { error: "Flow data was invalid. Please try saving again." };
  }

  const publishedAt = mode === "publish" ? new Date().toISOString() : null;
  if (mode === "publish") {
    const issues = validateBuilderGraph(graph);
    if (issues.length > 0) return { error: issues[0].message };
  }
  const actions = { ...graph, meta: { publishedAt } };

  const supabase = await createClient();

  if (automationId) {
    const { data: existing, error: lookupError } = await supabase
      .from("automations")
      .select("status")
      .eq("id", automationId)
      .maybeSingle();
    if (lookupError) return { error: lookupError.message };
    if (existing?.status === "active") {
      return { error: "This flow is live, so it can't be edited here. Nothing was changed." };
    }

    const { error } = await supabase
      .from("automations")
      .update({ name: flowName, status: "draft", actions, updated_at: new Date().toISOString() })
      .eq("id", automationId);
    if (error) return { error: error.message };
    revalidateServicesPage();
    revalidatePath(`/automation/services/${serviceId}/builder`);
    return { automationId, publishedAt };
  }

  const { data, error } = await supabase
    .from("automations")
    .insert({ service_id: serviceId, name: flowName, status: "draft", actions })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Failed to save the flow." };
  }

  revalidateServicesPage();
  revalidatePath(`/automation/services/${serviceId}/builder`);
  return { automationId: data.id, publishedAt };
}
