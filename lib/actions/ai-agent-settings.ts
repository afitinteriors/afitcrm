"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit";
import type { AiAgentMode } from "@/lib/supabase/types";

export type AiAgentSettingsState = { error: string } | null;

// Blueprint V1 Section 12: "AI agent: ... draft or automatic mode, on or
// off" -- owner-editable. Authorization is enforced by RLS
// (ai_agent_settings_update_admin_only), same as every other admin-only
// write in this app; the profile-role check here is a UX-only early exit,
// not the real boundary.
export async function updateAiAgentSettings(_prevState: AiAgentSettingsState, formData: FormData): Promise<AiAgentSettingsState> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") return { error: "You do not have access to this setting." };

  const enabled = formData.get("enabled") === "on";
  const mode = formData.get("mode");
  if (mode !== "draft" && mode !== "automatic") return { error: "Invalid mode." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_agent_settings")
    // No DB trigger maintains updated_at (none exist anywhere in this
    // schema) -- set explicitly, same convention as every other update in
    // this codebase (e.g. conversations.updated_at in lib/whatsapp/ingest.ts).
    .update({ enabled, mode: mode as AiAgentMode, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", true);

  if (error) return { error: error.message };

  await recordAuditEvent({
    actorId: profile.id,
    action: "setting_changed",
    targetType: "setting",
    metadata: { setting: "ai_agent", enabled, mode },
  });

  revalidatePath("/settings/ai-agent");
  return null;
}
