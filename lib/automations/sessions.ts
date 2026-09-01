import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AutomationSessionRow, AutomationSessionStatus } from "@/lib/supabase/types";

// Conversational session-state foundation. This is deliberately NOT a
// graph-walking engine -- it only tracks which automation currently
// "engages" a conversation and its lifecycle (active -> completed/failed/
// handed_off). Server-side only: every write here goes through the
// webhook's service-role client, the same as automation_runs today.
// Concurrency is enforced by the database
// (automation_sessions_one_engaged_per_conversation, a partial unique
// index on conversation_id WHERE status IN ('active','handed_off')), not
// by an application-level check-then-insert -- a check here would still
// race under concurrent webhook deliveries; the DB constraint cannot.

// Only active/handed_off sessions "engage" a conversation -- completed and
// failed sessions never block a future matching keyword from starting a
// new one.
export async function getEngagedSession(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<AutomationSessionRow | null> {
  const { data, error } = await supabase
    .from("automation_sessions")
    .select("*")
    .eq("conversation_id", conversationId)
    .in("status", ["active", "handed_off"])
    .maybeSingle();

  if (error) {
    console.error("Failed to look up engaged automation session:", error.message);
    return null;
  }
  return data;
}

// Returns null (never throws) on a 23505 conflict from the partial unique
// index -- a concurrent delivery already engaged this conversation between
// the caller's own getEngagedSession() check and this insert. The caller
// must treat null as "do not execute," never retry into a second
// execution.
export async function startSession(
  supabase: SupabaseClient<Database>,
  params: { conversationId: string; automationId: string; currentNodeId: string }
): Promise<AutomationSessionRow | null> {
  const { data, error } = await supabase
    .from("automation_sessions")
    .insert({
      conversation_id: params.conversationId,
      automation_id: params.automationId,
      current_node_id: params.currentNodeId,
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code !== "23505") {
      console.error("Failed to start automation session:", error.message);
    }
    return null;
  }
  return data;
}

// `expectedCurrentNodeId`, when passed, makes this an optimistic-concurrency
// write: the update only applies if current_node_id still matches what the
// caller originally read. Returns false (not an error) when it doesn't --
// another concurrent delivery already advanced this session first, and the
// caller must treat that as "lost the race," never let its own effects
// stand as if they'd advanced the session.
export async function markSessionTerminal(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  status: Extract<AutomationSessionStatus, "completed" | "failed" | "handed_off">,
  options?: {
    lastMessageId?: string;
    expectedCurrentNodeId?: string;
    mergeCollectedData?: { previous: Record<string, unknown>; patch: Record<string, string> };
  }
): Promise<boolean> {
  const collectedData = options?.mergeCollectedData
    ? { ...options.mergeCollectedData.previous, ...options.mergeCollectedData.patch }
    : undefined;

  // `status = "active"` is the real concurrency guard for a terminal write,
  // not `current_node_id` -- unlike pauseSessionAt, this function never
  // changes current_node_id, so two concurrent terminal writes starting
  // from the same node would otherwise both satisfy an identical
  // expectedCurrentNodeId condition (nothing ever changes it out from under
  // the second writer). status DOES change on the first successful write
  // (active -> completed/failed/handed_off), so the second writer's
  // otherwise-identical WHERE clause correctly stops matching the instant
  // the first commits -- the same atomic-conditional-update principle
  // pauseSessionAt already uses via current_node_id, applied here to the
  // column this function actually mutates. Every real call site only ever
  // calls this on a session that is (and, absent a race, remains) "active"
  // -- a handed_off session is never resumed (trigger.ts), and this
  // function is the only place a session ever leaves "active" -- so this
  // condition never rejects a legitimate, non-racing call.
  let query = supabase
    .from("automation_sessions")
    .update({
      status,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(options?.lastMessageId ? { last_message_id: options.lastMessageId } : {}),
      ...(collectedData ? { collected_data: collectedData } : {}),
    })
    .eq("id", sessionId)
    .eq("status", "active");

  if (options?.expectedCurrentNodeId !== undefined) {
    query = query.eq("current_node_id", options.expectedCurrentNodeId);
  }

  const { data, error } = await query.select("id");

  if (error) {
    console.error(`Failed to mark automation session ${status}:`, error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

// Persists a pause at a new node using the node the session was previously
// at (`expectedCurrentNodeId`) as the same optimistic-concurrency guard.
// Zero rows affected means another concurrent delivery already moved this
// session first -- the caller must not treat its own walk as having
// advanced the session.
//
// Also requires `status = "active"`, for the same reason
// markSessionTerminal does: this function doesn't touch `status`, so
// without this check a resume that started before a concurrent, external
// terminal-style transition (human handoff -- lib/actions/messages.ts's
// handOffActiveSession, which flips status without changing
// current_node_id) could still land here afterward, since
// current_node_id alone wouldn't have changed. The customer's stale
// resume would then silently overwrite current_node_id/collected_data on
// an already-handed-off session -- current_node_id being live-again is
// harmless on its own (a handed_off session is never resumed --
// trigger.ts's own status check), but the resume would have already
// executed its own node(s) (including a possible outbound send) between
// the handoff and this write, which must not be allowed to count as a
// legitimate advance. Requiring status="active" here closes that window
// the same way it already closes the equivalent one for
// markSessionTerminal.
export async function pauseSessionAt(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  expectedCurrentNodeId: string,
  newNodeId: string,
  lastMessageId: string,
  mergeCollectedData?: { previous: Record<string, unknown>; patch: Record<string, string> }
): Promise<boolean> {
  const collectedData = mergeCollectedData ? { ...mergeCollectedData.previous, ...mergeCollectedData.patch } : undefined;

  const { data, error } = await supabase
    .from("automation_sessions")
    .update({
      current_node_id: newNodeId,
      updated_at: new Date().toISOString(),
      last_message_id: lastMessageId,
      ...(collectedData ? { collected_data: collectedData } : {}),
    })
    .eq("id", sessionId)
    .eq("current_node_id", expectedCurrentNodeId)
    .eq("status", "active")
    .select("id");

  if (error) {
    console.error("Failed to pause automation session:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

// Marks any currently-active automation session for a conversation as
// handed_off, without needing to already know its session id -- a blind
// conditional UPDATE keyed by conversation_id + status="active", the same
// atomic-conditional-update principle as markSessionTerminal/
// pauseSessionAt above. automation_sessions_one_engaged_per_conversation
// guarantees at most one row can ever match, so this can never affect
// more than one session.
//
// Called from the staff/admin manual-reply path (lib/actions/
// messages.ts), which runs under a user-session Supabase client, not the
// webhook's service-role one -- unlike every other write in this file,
// authorization here comes from RLS itself
// (automation_sessions_handoff_admin_or_owner: admin, or the staff member
// the session's conversation's lead is assigned to), scoped to exactly
// this one transition (its USING clause requires status="active", its
// WITH CHECK requires the result be "handed_off" -- no other status
// transition is permitted through this policy). Returns false, not an
// error, when there's nothing to hand off (no active session) or the
// write was denied/lost a race to a concurrent customer reply that
// already resolved the session -- the caller's own manual reply has
// already succeeded either way and must never be affected by this
// result.
export async function handOffActiveSession(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("automation_sessions")
    .update({
      status: "handed_off",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .eq("status", "active")
    .select("id");

  if (error) {
    console.error("Failed to hand off automation session:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
