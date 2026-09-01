import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AutomationRunStatus, AutomationSessionRow } from "@/lib/supabase/types";
import { matchKeyword, type ActiveKeyword } from "./matching";
import { startAndAdvance, resumeAndAdvance } from "./executor";
import { parseAutomationGraph, findTriggerNodeId } from "./graph-schema";
import { getEngagedSession, startSession, markSessionTerminal, pauseSessionAt } from "./sessions";
import { RealOutboundSender, type OutboundSender } from "./outbound-sender";

export type TriggerResult = {
  runId: string | null;
  status: AutomationRunStatus;
};

type RunFields = {
  status: AutomationRunStatus;
  matched_keyword?: string;
  matched_service_id?: string;
  automation_id?: string;
  error_message?: string;
  session_id?: string;
};

const CONCURRENT_ADVANCE_ERROR = "Session was advanced by a concurrent message.";

// Called once per genuinely-new inbound message -- the caller (the webhook's
// ingestMessage) only reaches this after messages.insert() has already
// succeeded, so a Meta redelivery of the same wa_message_id never gets here
// at all (messages.wa_message_id's own UNIQUE constraint stops it first).
// automation_runs.message_id is a second, independent idempotency
// checkpoint in case of a genuine race between two concurrent deliveries.
export async function triggerAutomationForMessage(
  supabase: SupabaseClient<Database>,
  params: { messageId: string; conversationId: string; body: string | null; phone: string; customerName: string | null }
): Promise<TriggerResult> {
  // Constructed per automation execution with this call's own service-role
  // client -- never a module-level singleton (RealOutboundSender does its
  // own conversation lookups and writes, unlike the previous stateless
  // BlockedOutboundSender).
  const outboundSender: OutboundSender = new RealOutboundSender(supabase);

  // Conversational session-state check, before any keyword matching. A
  // conversation already engaged (active or handed_off) owns this message.
  const engagedSession = await getEngagedSession(supabase, params.conversationId);
  if (engagedSession) {
    if (engagedSession.status === "handed_off") {
      // Never resume a handed-off conversation -- automation has explicitly
      // stepped back. No production path sets this status yet, but the
      // guard is real and independent of that.
      return insertRun(supabase, params, { status: "no_match", session_id: engagedSession.id });
    }
    return resumeEngagedSession(supabase, params, engagedSession, outboundSender);
  }

  const [{ data: activeServices, error: servicesError }, { data: keywordRows, error: keywordsError }] =
    await Promise.all([
      supabase.from("services").select("id, name").eq("is_active", true),
      supabase.from("service_keywords").select("id, service_id, keyword, priority").eq("is_active", true),
    ]);

  if (servicesError || keywordsError) {
    console.error(
      "Failed to load active services/keywords for automation matching:",
      servicesError?.message ?? keywordsError?.message
    );
    return insertRun(supabase, params, { status: "no_match" });
  }

  const activeServiceNames = new Map((activeServices ?? []).map((s) => [s.id, s.name]));
  const activeKeywords: ActiveKeyword[] = (keywordRows ?? []).filter((k) => activeServiceNames.has(k.service_id));

  const match = matchKeyword(activeKeywords, params.body);

  if (match.outcome === "no_match") {
    return insertRun(supabase, params, { status: "no_match" });
  }

  if (match.outcome === "ambiguous") {
    // Rule 3: equal-priority ambiguity across different services is
    // reported, never silently resolved. "failed" is the closest fit in the
    // existing four-value status enum -- this genuinely did not complete as
    // a configured automation would, and error_message carries the exact
    // reason for an admin to resolve (e.g. lower one service's keyword
    // priority).
    return insertRun(supabase, params, {
      status: "failed",
      matched_keyword: match.keyword,
      error_message: `Ambiguous match: "${match.keyword}" matched active keywords from ${match.serviceIds.length} different services at equal priority (service ids: ${match.serviceIds.join(", ")}). Not resolved automatically.`,
    });
  }

  // match.outcome === "matched" -- a single service was identified.
  const { data: automation, error: automationError } = await supabase
    .from("automations")
    .select("id, actions")
    .eq("service_id", match.serviceId)
    .eq("status", "active")
    .maybeSingle();

  if (automationError) {
    console.error("Failed to look up active automation for matched service:", automationError.message);
    return insertRun(supabase, params, {
      status: "no_match",
      matched_keyword: match.keyword,
      matched_service_id: match.serviceId,
    });
  }

  if (!automation) {
    // Rule 7: keyword matched a real service, but that service has no
    // active automation. Distinguished from a true no-match by
    // matched_service_id being set here (and null there), without adding a
    // fifth status value.
    return insertRun(supabase, params, {
      status: "no_match",
      matched_keyword: match.keyword,
      matched_service_id: match.serviceId,
    });
  }

  // Locate the graph's entry node before starting a session -- an
  // unreadable/unsupported graph must fail here, before any session row
  // exists.
  let entryNodeId: string;
  try {
    const graph = parseAutomationGraph(automation.actions);
    const trigger = findTriggerNodeId(graph);
    if (!trigger) throw new Error("Automation flow has no trigger block.");
    entryNodeId = trigger;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation flow could not be read.";
    return insertRun(supabase, params, {
      status: "failed",
      matched_keyword: match.keyword,
      matched_service_id: match.serviceId,
      automation_id: automation.id,
      error_message: message,
    });
  }

  // Engage the conversation for this automation. The database's partial
  // unique index (automation_sessions_one_engaged_per_conversation) is the
  // real concurrency guard -- a concurrent delivery that raced past this
  // function's own getEngagedSession() check above and got here first will
  // have already inserted its session, so this insert fails closed (null)
  // rather than starting a second, competing execution.
  const session = await startSession(supabase, {
    conversationId: params.conversationId,
    automationId: automation.id,
    currentNodeId: entryNodeId,
  });

  if (!session) {
    return insertRun(supabase, params, {
      status: "no_match",
      matched_keyword: match.keyword,
      matched_service_id: match.serviceId,
    });
  }

  // Insert the run as the idempotency checkpoint BEFORE executing anything.
  // If a concurrent duplicate delivery races here, its insert fails on the
  // UNIQUE(message_id) constraint before it could ever start a second
  // execution.
  const pendingRun = await insertRun(supabase, params, {
    status: "pending",
    matched_keyword: match.keyword,
    matched_service_id: match.serviceId,
    automation_id: automation.id,
    session_id: session.id,
  });

  if (!pendingRun.runId) {
    // Either a genuine DB error, or (far more likely) this exact message
    // was already processed by a racing delivery -- either way, never
    // execute a second time.
    await markSessionTerminal(supabase, session.id, "failed");
    return pendingRun;
  }

  try {
    const outcome = await startAndAdvance(
      supabase,
      automation.actions,
      entryNodeId,
      {
        conversationId: params.conversationId,
        phone: params.phone,
        customerName: params.customerName,
        serviceName: activeServiceNames.get(match.serviceId) ?? "",
      },
      outboundSender
    );

    const collectedDataMerge = { previous: session.collected_data, patch: outcome.collectedData };
    const advanced =
      outcome.outcome === "paused"
        ? await pauseSessionAt(supabase, session.id, entryNodeId, outcome.nodeId, params.messageId, collectedDataMerge)
        : await markSessionTerminal(supabase, session.id, "completed", {
            lastMessageId: params.messageId,
            expectedCurrentNodeId: entryNodeId,
            mergeCollectedData: collectedDataMerge,
          });

    if (!advanced) {
      // A concurrent second delivery on the same conversation reached this
      // session first -- never let this request's own effects stand as if
      // they'd advanced it.
      await supabase
        .from("automation_runs")
        .update({ status: "failed", error_message: CONCURRENT_ADVANCE_ERROR, completed_at: new Date().toISOString() })
        .eq("id", pendingRun.runId);
      return { runId: pendingRun.runId, status: "failed" };
    }

    await supabase
      .from("automation_runs")
      .update({ status: "matched", completed_at: new Date().toISOString() })
      .eq("id", pendingRun.runId);
    return { runId: pendingRun.runId, status: "matched" };
  } catch (err) {
    // Rule 9: a failed automation must never affect the already-persisted
    // inbound message -- this catch is local to trigger execution only.
    const message = err instanceof Error ? err.message : "Unknown automation execution error.";
    await markSessionTerminal(supabase, session.id, "failed", { lastMessageId: params.messageId });
    await supabase
      .from("automation_runs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", pendingRun.runId);
    return { runId: pendingRun.runId, status: "failed" };
  }
}

async function resumeEngagedSession(
  supabase: SupabaseClient<Database>,
  params: { messageId: string; conversationId: string; body: string | null; phone: string; customerName: string | null },
  session: AutomationSessionRow,
  outboundSender: OutboundSender
): Promise<TriggerResult> {
  // automation_id can be null if the automation was deleted while this
  // session was mid-flow (ON DELETE SET NULL) -- nothing left to resume
  // against.
  if (!session.automation_id) {
    await markSessionTerminal(supabase, session.id, "failed");
    return insertRun(supabase, params, {
      status: "failed",
      session_id: session.id,
      error_message: "The automation for this session no longer exists.",
    });
  }

  const { data: automationRow, error: automationFetchError } = await supabase
    .from("automations")
    .select("id, service_id, actions")
    .eq("id", session.automation_id)
    .maybeSingle();

  if (automationFetchError || !automationRow) {
    await markSessionTerminal(supabase, session.id, "failed");
    return insertRun(supabase, params, {
      status: "failed",
      session_id: session.id,
      error_message: automationFetchError?.message ?? "The automation for this session could not be found.",
    });
  }

  // A reply with no usable text (e.g. a bare image/sticker/location with no
  // caption) is never captured as an empty value -- the session is left
  // completely untouched, still active, still waiting at the same node, so
  // the next real text reply resumes correctly. No session-state write
  // happens in this branch at all: nothing to roll back, nothing to
  // corrupt.
  if (!params.body || params.body.trim().length === 0) {
    return insertRun(supabase, params, {
      status: "no_match",
      session_id: session.id,
      error_message: "Inbound message had no usable text -- session left waiting at its current step.",
    });
  }

  const { data: serviceRow } = await supabase
    .from("services")
    .select("name")
    .eq("id", automationRow.service_id)
    .maybeSingle();

  const pendingRun = await insertRun(supabase, params, { status: "pending", session_id: session.id });
  if (!pendingRun.runId) {
    // Redelivery of an already-processed reply -- unchanged idempotency.
    return pendingRun;
  }

  try {
    const outcome = await resumeAndAdvance(
      supabase,
      automationRow.actions,
      session.current_node_id,
      params.body,
      {
        conversationId: params.conversationId,
        phone: params.phone,
        customerName: params.customerName,
        serviceName: serviceRow?.name ?? "",
      },
      outboundSender
    );

    const collectedDataMerge = { previous: session.collected_data, patch: outcome.collectedData };
    const advanced =
      outcome.outcome === "paused"
        ? await pauseSessionAt(
            supabase,
            session.id,
            session.current_node_id,
            outcome.nodeId,
            params.messageId,
            collectedDataMerge
          )
        : await markSessionTerminal(supabase, session.id, "completed", {
            lastMessageId: params.messageId,
            expectedCurrentNodeId: session.current_node_id,
            mergeCollectedData: collectedDataMerge,
          });

    if (!advanced) {
      await supabase
        .from("automation_runs")
        .update({ status: "failed", error_message: CONCURRENT_ADVANCE_ERROR, completed_at: new Date().toISOString() })
        .eq("id", pendingRun.runId);
      return { runId: pendingRun.runId, status: "failed" };
    }

    await supabase
      .from("automation_runs")
      .update({ status: "matched", completed_at: new Date().toISOString() })
      .eq("id", pendingRun.runId);
    return { runId: pendingRun.runId, status: "matched" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown automation execution error.";
    await markSessionTerminal(supabase, session.id, "failed", { lastMessageId: params.messageId });
    await supabase
      .from("automation_runs")
      .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", pendingRun.runId);
    return { runId: pendingRun.runId, status: "failed" };
  }
}

async function insertRun(
  supabase: SupabaseClient<Database>,
  params: { messageId: string; conversationId: string },
  fields: RunFields
): Promise<TriggerResult> {
  const isTerminal = fields.status !== "pending";

  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      message_id: params.messageId,
      conversation_id: params.conversationId,
      ...fields,
      ...(isTerminal ? { completed_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Duplicate message_id -- this message was already processed by a
      // prior (possibly concurrent) delivery. Not an error; do nothing more.
      return { runId: null, status: fields.status };
    }
    console.error("Failed to record automation_run:", error.message);
    return { runId: null, status: "failed" };
  }

  return { runId: data.id, status: fields.status };
}
