import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { parseAutomationGraph, getOutgoingEdges, type AutomationGraphV2 } from "./graph-schema";
import { createOrLinkLeadForConversation, captureLeadField } from "./crm-actions";
import type { OutboundSender } from "./outbound-sender";

// Sequential, single-outgoing-edge graph traversal. This replaces the
// earlier "does the graph contain an enabled node anywhere" check with real
// reachability from wherever the walk starts -- a create_or_link_lead node
// that isn't actually connected no longer executes (a deliberate, approved
// correction, not a regression: every graph built through the builder has
// always connected the two directly).
//
// send_text and ask_question execute identically -- both call
// outboundSender.sendText() and continue, never pausing. ask_question is a
// distinct node type purely for builder clarity (a business wants to see
// "Ask Question" as an intentional block, not a reused "Send Text"); it
// does not itself wait for anything -- pairing it with a following
// capture_lead_field block (which is what actually pauses) is a product
// convention, not an engine rule.
//
// send_image and send_video execute identically to send_text/ask_question
// (call outboundSender.sendMedia() and continue, never pausing) -- see
// outbound-sender.ts for the media-id resolution/caching/self-healing
// logic, none of which the executor needs to know about.
//
// Node types with no defined execution behavior here (condition) are not
// silently skipped -- reaching one fails the walk closed with a specific
// "unsupported block type" error. It isn't addable through the builder
// today, so this only matters as defense-in-depth against a hand-edited
// graph.

// No node type here can create a cycle through the builder's own rules
// (isValidConnection blocks a node connecting directly to itself, and
// validateGraphForSave/parseAutomationGraph never inspect the edge
// topology for longer cycles) -- but a graph loaded straight from the
// database (a hand-edited row, a future bug, anything bypassing the
// builder entirely) could still describe one.
//
// Primary defense: a visited-node-id set, scoped to one walk() call only
// (never persisted, never carried across webhook requests). If the walker
// is about to revisit a node id it has already processed during this same
// continuous execution, that is unambiguously a cycle -- there is no
// legitimate reason a single sequential pass would return to a node it
// already ran. Detected and failed BEFORE that node's action executes
// again, so a repeated send_text/ask_question is never actually sent a
// second time; each outbound-capable node can execute at most once per
// walk. Being scoped to the call (a fresh Set every time walk() runs)
// is exactly what keeps this from misfiring on legitimate pause/resume:
// a fresh inbound message starts a brand-new walk() with a brand-new
// empty visited set, so a node genuinely revisited across two *separate*
// webhook deliveries (the normal, expected shape of resuming a paused
// capture_lead_field) is never mistaken for a cycle -- only a node
// revisited within the same continuous pass is.
//
// Defense-in-depth: a hard cap on how many nodes a single walk() call may
// visit at all, in case a future bug or node type ever produces a "cycle"
// that doesn't strictly revisit an id (e.g. an unbounded generator of new
// ids), or simply as a second, independent backstop. 30 is generous for
// any realistic flow built in this project so far (the largest so far had
// 9 nodes).
export const MAX_GRAPH_STEPS = 30;

export class GraphExecutionLimitError extends Error {}
export class GraphCycleError extends Error {}

export type ExecutionContext = {
  conversationId: string;
  phone: string;
  customerName: string | null;
  serviceName: string;
};

export type WalkOutcome = { outcome: "completed"; collectedData: Record<string, string> } | {
  outcome: "paused";
  nodeId: string;
  collectedData: Record<string, string>;
};

// `replyText` is only meaningful for the very first node visited -- it
// represents an inbound reply being resumed into a node the session was
// paused at. Every node reached after that is a fresh forward step with no
// reply available, exactly like a brand-new walk from the trigger node.
// `collectedData` in the result is only what THIS call captured (raw reply
// text keyed by fieldKey) -- the caller merges it onto the session's
// existing collected_data, it is not a replacement.
async function walk(
  supabase: SupabaseClient<Database>,
  graph: AutomationGraphV2,
  startNodeId: string,
  replyText: string | undefined,
  context: ExecutionContext,
  outboundSender: OutboundSender
): Promise<WalkOutcome> {
  let currentId = startNodeId;
  let pendingReply = replyText;
  const collectedData: Record<string, string> = {};
  const visited = new Set<string>();
  let steps = 0;

  for (;;) {
    steps += 1;
    if (steps > MAX_GRAPH_STEPS) {
      // Defense-in-depth only -- the visited-set check below should always
      // catch a real cycle well before this fires. Fail closed before
      // visiting another node either way.
      throw new GraphExecutionLimitError(
        `Automation flow exceeded ${MAX_GRAPH_STEPS} steps in a single execution -- this usually means the flow's connections form a cycle. Check the blocks around "${currentId}" in the flow builder.`
      );
    }

    if (visited.has(currentId)) {
      // Revisiting a node within the same continuous walk -- unambiguously
      // a cycle. Fail here, before this node is looked up or executed
      // again, so a repeated send_text/ask_question is never sent twice.
      throw new GraphCycleError(
        `Automation flow revisited block "${currentId}" during the same execution -- this means the flow's connections form a cycle. Check the blocks around "${currentId}" in the flow builder.`
      );
    }
    visited.add(currentId);

    const node = graph.nodes.find((n) => n.id === currentId);
    if (!node) {
      throw new Error(`Automation flow references an unknown block (${currentId}).`);
    }

    switch (node.type) {
      case "trigger":
        break; // structural, no effect
      case "end":
        return { outcome: "completed", collectedData };
      case "create_or_link_lead":
        // Not caught here -- a real failure must propagate to trigger.ts's
        // own try/catch, which marks the whole run "failed" with the error.
        await createOrLinkLeadForConversation(supabase, context);
        break;
      case "send_text":
      case "ask_question": {
        const text = node.data?.text;
        if (!text) {
          throw new Error(`"${node.type === "ask_question" ? "Ask Question" : "Send Text"}" block (${node.id}) has no text configured.`);
        }
        // Not caught here -- same propagation rule as every other action.
        // The only wired sender today (BlockedOutboundSender) always
        // throws, so this fails the run/session closed rather than faking
        // delivery.
        await outboundSender.sendText(context.conversationId, text);
        break;
      }
      case "send_image":
      case "send_video": {
        const mediaAssetId = node.data?.mediaAssetId;
        if (!mediaAssetId) {
          throw new Error(`"${node.type === "send_image" ? "Send Image" : "Send Video"}" block (${node.id}) has no media selected.`);
        }
        // Same propagation rule as every other node action -- not caught
        // here, so a failed media send (upload rejected, Meta send
        // rejected even after the self-healing re-upload retry) fails the
        // run/session closed exactly like a failed send_text.
        await outboundSender.sendMedia(context.conversationId, mediaAssetId);
        break;
      }
      case "capture_lead_field": {
        const fieldKey = node.data?.fieldKey;
        if (!fieldKey) {
          throw new Error(`"Capture Lead Field" block (${node.id}) has no field configured.`);
        }
        if (pendingReply === undefined) {
          // Forward arrival with nothing to capture yet -- this is the
          // pause point. The caller persists current_node_id here.
          return { outcome: "paused", nodeId: node.id, collectedData };
        }
        // captureLeadField() returns the field's actual, DB-confirmed value
        // after its own atomic write/never-clobber race resolves -- not
        // necessarily this walk's own pendingReply -- so collected_data
        // always agrees with whatever really ended up in the lead row,
        // even if this execution lost a concurrent capture race for the
        // same field (see crm-actions.ts for the mechanism).
        const recordedValue = await captureLeadField(supabase, {
          conversationId: context.conversationId,
          fieldKey,
          replyText: pendingReply,
        });
        collectedData[fieldKey] = recordedValue;
        pendingReply = undefined;
        break;
      }
      default:
        throw new Error(`Automation flow contains an unsupported block type ("${node.type}").`);
    }

    const outgoing = getOutgoingEdges(graph, currentId);
    if (outgoing.length === 0) return { outcome: "completed", collectedData };
    if (outgoing.length > 1) {
      throw new Error(`Automation flow block (${currentId}) has more than one outgoing connection.`);
    }
    currentId = outgoing[0].target;
  }
}

// Fresh match: walk starts at the graph's trigger node with no reply to
// consume. Throws on a missing/legacy/unrecognized version, exactly as
// before -- not caught here, so it propagates to trigger.ts's catch and
// marks the run "failed" with a clear reason.
export async function startAndAdvance(
  supabase: SupabaseClient<Database>,
  rawActions: unknown,
  triggerNodeId: string,
  context: ExecutionContext,
  outboundSender: OutboundSender
): Promise<WalkOutcome> {
  const graph = parseAutomationGraph(rawActions);
  return walk(supabase, graph, triggerNodeId, undefined, context, outboundSender);
}

// Resume: walk starts at wherever the session was paused, consuming the
// inbound reply as that node's input.
export async function resumeAndAdvance(
  supabase: SupabaseClient<Database>,
  rawActions: unknown,
  currentNodeId: string,
  replyText: string,
  context: ExecutionContext,
  outboundSender: OutboundSender
): Promise<WalkOutcome> {
  const graph = parseAutomationGraph(rawActions);
  return walk(supabase, graph, currentNodeId, replyText, context, outboundSender);
}
