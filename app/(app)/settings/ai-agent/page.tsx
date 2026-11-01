import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AiAgentSettingsForm } from "@/components/settings/AiAgentSettingsForm";

export default async function AiAgentSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const supabase = await createClient();
  const { data: settings } = await supabase.from("ai_agent_settings").select("enabled, mode").eq("id", true).single();

  return (
    <div>
      <Link href="/settings" className="text-xs font-medium text-muted-foreground hover:text-foreground">
        ← Settings
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-foreground">AI agent</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Drafts the first reply to a new WhatsApp lead when no automation flow already handles it.
      </p>

      <div className="mt-6 max-w-md">
        <AiAgentSettingsForm enabled={settings?.enabled ?? false} mode={settings?.mode ?? "draft"} />
      </div>
    </div>
  );
}
