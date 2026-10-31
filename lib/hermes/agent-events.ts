import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentEventType, Database, LeadRow } from "@/lib/supabase/types";

type RecordAgentEventInput = {
  eventType: AgentEventType;
  toolName: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

// Blueprint V1 Section 11: "agent_events: what Hermes read, sent and
// created." Fail-open by design, same reasoning as lib/audit.ts's
// recordAuditEvent -- logging this must never block the tool call it
// describes. Always called with the admin (service-role) client: Hermes
// itself never writes here directly (Section 9: no database access).
export async function recordAgentEvent(supabase: SupabaseClient<Database>, input: RecordAgentEventInput): Promise<void> {
  try {
    const { error } = await supabase.from("agent_events").insert({
      event_type: input.eventType,
      tool_name: input.toolName,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });

    if (error) {
      console.error(`Failed to record agent event (${input.toolName}):`, error.message);
    }
  } catch (err) {
    console.error(`Unexpected error recording agent event (${input.toolName}):`, err);
  }
}

// Blueprint V1 Section 9's privacy rule: "messages Hermes sends or sends to
// its model show lead number, area and service ... but not phone numbers or
// full names. Details open from a CRM link." This app's leads.id is a UUID,
// not a sequential number -- no such column exists (see the gap report),
// so the first 8 hex characters stand in as a short, stable reference
// rather than inventing a new schema column for this increment.
export function privacySafeLeadReference(lead: Pick<LeadRow, "id" | "location" | "service_required" | "project_type">): string {
  const shortId = lead.id.slice(0, 8).toUpperCase();
  const area = lead.location ?? "Unknown area";
  const service = lead.service_required ?? lead.project_type ?? "Unknown service";
  return `Lead ${shortId} — ${area} — ${service}`;
}
