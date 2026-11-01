import "server-only";
import type { LeadRow } from "@/lib/supabase/types";
import { nextMissingField, draftQuestion, describeKnownFields, type QualificationField } from "@/lib/ai/qualification";

// Blueprint V1 Section 6: the customer AI agent's first reply to a brand
// new lead. Thin wrapper over lib/ai/qualification.ts's shared
// field-priority/question-drafting engine (increment 2) -- the very first
// message and a mid-conversation follow-up (lib/ai/session-trigger.ts)
// are governed by the exact same rules, not two copies that can drift.
export type FirstReplyInput = Pick<
  LeadRow,
  "service_required" | "project_type" | "location" | "estimated_sqft" | "expected_start_date"
> & { messageBody: string };

export type FirstReplyResult = { text: string; field: QualificationField | null };

// Returns null if Gemini isn't configured -- the caller (lib/ai/draft-trigger.ts)
// treats that as "skip silently," the same best-effort convention
// lib/whatsapp/ingest.ts already uses for automation triggering: a
// missing/failed AI draft must never block message ingestion or surface
// as an ingestion error.
export async function draftFirstReply(lead: FirstReplyInput): Promise<FirstReplyResult | null> {
  const field = nextMissingField(lead);
  if (!field) return null; // everything already known -- nothing to ask; increment 2's confirmation path takes over instead.

  const text = await draftQuestion(field, describeKnownFields(lead.service_required, lead), lead.messageBody);
  if (!text) return null;
  return { text: text.trim(), field };
}
