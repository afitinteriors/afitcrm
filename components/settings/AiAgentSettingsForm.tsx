"use client";

import { useActionState } from "react";
import { updateAiAgentSettings } from "@/lib/actions/ai-agent-settings";
import type { AiAgentMode } from "@/lib/supabase/types";

// Blueprint V1 Section 12: the owner's draft/automatic switch. Draft mode
// means every AI-suggested reply waits in the Conversation view for a tap
// to send (components/conversations/AiDraftCard.tsx); automatic sends it
// immediately. "Enabled" off means the agent drafts nothing at all --
// existing manual replies are completely unaffected either way.
export function AiAgentSettingsForm({ enabled, mode }: { enabled: boolean; mode: AiAgentMode }) {
  const [state, formAction, isPending] = useActionState(updateAiAgentSettings, null);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      <label className="flex items-center justify-between">
        <span>
          <span className="block text-sm font-medium text-foreground">AI agent enabled</span>
          <span className="block text-xs text-muted-foreground">Off: no drafts are generated at all, for any lead.</span>
        </span>
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="h-5 w-9 shrink-0 accent-[#16A34A]" />
      </label>

      <div>
        <p className="mb-1.5 text-sm font-medium text-foreground">Mode</p>
        <div className="space-y-2">
          <label className="flex items-start gap-2 rounded-lg border border-border p-2.5 has-[:checked]:border-[#16A34A] has-[:checked]:bg-emerald-50">
            <input type="radio" name="mode" value="draft" defaultChecked={mode === "draft"} className="mt-0.5 accent-[#16A34A]" />
            <span>
              <span className="block text-sm text-foreground">Draft mode</span>
              <span className="block text-xs text-muted-foreground">Every reply waits for a staff tap to send. Recommended rollout default.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-border p-2.5 has-[:checked]:border-[#16A34A] has-[:checked]:bg-emerald-50">
            <input type="radio" name="mode" value="automatic" defaultChecked={mode === "automatic"} className="mt-0.5 accent-[#16A34A]" />
            <span>
              <span className="block text-sm text-foreground">Automatic</span>
              <span className="block text-xs text-muted-foreground">Sends the first reply immediately, no review.</span>
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="h-10 rounded-md bg-[#16A34A] px-4 text-sm font-medium text-white hover:bg-[#15803D] disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
