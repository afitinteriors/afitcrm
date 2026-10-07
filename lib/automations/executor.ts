import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  parseBuilderGraph,
  getOutgoingEdge,
  NEXT_PORT,
  type BuilderGraph,
  type ChoiceItem,
} from "./builder-graph";
import {
  createOrLinkLeadForConversation,
  captureLeadField,
  updateLeadStage,
  assignStaffSpecific,
  createAutomationFollowUp,
} from "./crm-actions";
import type { OutboundSender } from "./outbound-sender";

// Sequential graph traversal over the v3 Builder graph (lib/automations/
// builder-graph.ts). Every automation saved through the Builder has been v3
// since that phase shipped -- parseBuilderGraph() transparently upgrades
// any remaining legacy v2 row on read, so this is the one graph format the
// executor needs to understand. (Previously this file called graph-schema.ts's
// v2-only parseAutomationGraph() directly, which meant no flow saved through
// the v3 Builder could ever execute at all -- parseAutomationGraph() throws
// UnsupportedAutomationVersionError for version 3. That was the actual
// runtime-compatibility gap, not any single node type.)
//
// Unlike v2 (exactly one outgoing edge per node), a v3 node can expose
// several named ports (trigger's matched/not_matched; buttons'/
// list_message's one port per configured option) -- getOutgoingEdge()
// follows the edge leaving the SPECIFIC port a node just finished with.
//
// send_text/ask_question, send_image/send_video/send_document all execute
// identically to their v2 counterparts (call the matching OutboundSender
// method and continue, never pausing on their own) -- see outbound-sender.ts.
// ask_question being a distinct type from send_text is builder clarity only,
// same as before; something that actually waits for a reply (save_to_crm
// with valueSource "customer_reply", buttons, list_message) must follow it.
//
// Node types with no defined execution behavior here (condition, branch,
// delay, jump_to, add_tag, notify_team, send_audio, send_template, and every
// non-keyword trigger type) are not silently skipped -- reaching one fails
// the walk closed with a specific "unsupported block type" error, the same
// convention the v2 executor used for `condition`. None of these are used by
// any flow this phase built or needed to run.

export const MAX_GRAPH_STEPS = 30;

export class GraphExecutionLimitError extends Error {}
export class GraphCycleError extends Error {}

export type ExecutionContext = {
  conversationId: string;
  phone: string;
  customerName: string | null;
  serviceName: string;
};

export type WalkOutcome =
  | { outcome: "completed"; collectedData: Record<string, string> }
  | { outcome: "paused"; nodeId: string; collectedData: Record<string, string> };

const DEFAULT_FOLLOW_UP_DUE_HOURS = 24;

// Matches a customer's free-text reply to one of a buttons/list_message
// block's configured options. WhatsApp interactive replies aren't sent by
// anything in this codebase yet (OutboundSender has no interactive-message
// method -- these blocks compose a plain numbered text list, same as every
// other send here), so a reply is always plain text: matched either by its
// 1-based position ("2", "2.", "(2)") or by a case-insensitive
// containment of the option's label, mirroring the same contains-match
// convention lib/automations/text.ts already uses for keyword matching.
// Returns null, never a guess, when nothing matches.
function matchChoice(reply: string, choices: ChoiceItem[]): ChoiceItem | null {
  const trimmed = reply.trim();
  const numeric = trimmed.match(/^\(?(\d+)\)?\.?$/);
  if (numeric) {
    const index = Number(numeric[1]) - 1;
    if (index >= 0 && index < choices.length) return choices[index];
  }
  const normalized = trimmed.toLowerCase();
  const byLabel = choices.find((c) => c.label.trim().toLowerCase() === normalized);
  if (byLabel) return byLabel;
  return choices.find((c) => normalized.includes(c.label.trim().toLowerCase())) ?? null;
}

// Composes the plain-text prompt for a buttons/list_message block: the
// configured message text, followed by one numbered line per option. This
// is the entire rendering -- there is no real interactive-button send path
// (see matchChoice's comment), so the numbering is also what a reply is
// matched against.
function composeChoicePrompt(text: string, listTitle: string | undefined, choices: ChoiceItem[]): string {
  const lines = choices.map((c, i) => `${i + 1}. ${c.label}`);
  const header = listTitle ? `${text}\n\n${listTitle}:` : text;
  return `${header}\n${lines.join("\n")}`;
}

async function walk(
  supabase: SupabaseClient<Database>,
  graph: BuilderGraph,
  startNodeId: string,
  startPort: string,
  replyText: string | undefined,
  context: ExecutionContext,
  outboundSender: OutboundSender
): Promise<WalkOutcome> {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  let currentId = startNodeId;
  let pendingReply = replyText;
  let isFirstNode = true;
  const collectedData: Record<string, string> = {};
  const visited = new Set<string>();
  let steps = 0;

  for (;;) {
    steps += 1;
    if (steps > MAX_GRAPH_STEPS) {
      throw new GraphExecutionLimitError(
        `Automation flow exceeded ${MAX_GRAPH_STEPS} steps in a single execution -- this usually means the flow's connections form a cycle. Check the blocks around "${currentId}" in the flow builder.`
      );
    }
    if (visited.has(currentId)) {
      throw new GraphCycleError(
        `Automation flow revisited block "${currentId}" during the same execution -- this means the flow's connections form a cycle. Check the blocks around "${currentId}" in the flow builder.`
      );
    }
    visited.add(currentId);

    const node = byId.get(currentId);
    if (!node) {
      throw new Error(`Automation flow references an unknown block (${currentId}).`);
    }

    // The port this node will leave by, once its action (if any) below
    // decides it's done. Branching nodes (trigger/buttons/list_message)
    // overwrite this themselves; every other node always leaves via "next".
    let leavingPort = NEXT_PORT;

    switch (node.type) {
      case "trigger": {
        // Structural only -- real keyword matching already happened in
        // trigger.ts before this walk started (service_keywords, not this
        // node's own `keywords` field -- see the module comment on why
        // those are two separate things today). The walk is only ever
        // started here with startPort="matched" from real inbound traffic;
        // "not_matched" is reachable by calling walk()/startAndAdvance()
        // directly with that start port (what the synthetic tests do), not
        // by anything in the real message pipeline -- see this file's own
        // "known gap" note in the Step 7 report for why.
        leavingPort = isFirstNode ? startPort : NEXT_PORT;
        break;
      }

      case "end_flow":
        return { outcome: "completed", collectedData };

      case "create_or_link_lead":
        await createOrLinkLeadForConversation(supabase, context);
        break;

      case "send_text":
      case "ask_question": {
        const text = node.data.text;
        if (!text) {
          throw new Error(`"${node.type === "ask_question" ? "Ask Question" : "Send Text"}" block (${node.id}) has no text configured.`);
        }
        await outboundSender.sendText(context.conversationId, text);
        break;
      }

      case "send_image":
      case "send_video": {
        const mediaAssetId = node.data.mediaAssetId;
        if (!mediaAssetId) {
          throw new Error(`"${node.type === "send_image" ? "Send Image" : "Send Video"}" block (${node.id}) has no media selected.`);
        }
        await outboundSender.sendMedia(context.conversationId, mediaAssetId);
        break;
      }

      case "send_document": {
        const mediaAssetId = node.data.mediaAssetId;
        if (!mediaAssetId) {
          throw new Error(`"Send Document" block (${node.id}) has no file selected.`);
        }
        await outboundSender.sendDocument(context.conversationId, mediaAssetId);
        break;
      }

      case "save_to_crm": {
        const fieldKey = node.data.fieldKey;
        if (!fieldKey) {
          throw new Error(`"Save to CRM" block (${node.id}) has no field configured.`);
        }
        const isFixed = node.type === "save_to_crm" && node.data.valueSource === "fixed";
        if (isFixed) {
          const fixedValue = node.data.fixedValue;
          if (!fixedValue) {
            throw new Error(`"Save to CRM" block (${node.id}) has no fixed value configured.`);
          }
          const recordedValue = await captureLeadField(supabase, {
            conversationId: context.conversationId,
            fieldKey,
            replyText: fixedValue,
          });
          collectedData[fieldKey] = recordedValue;
          break;
        }
        if (pendingReply === undefined) {
          // Pause point -- the caller persists current_node_id here.
          return { outcome: "paused", nodeId: node.id, collectedData };
        }
        const recordedValue = await captureLeadField(supabase, {
          conversationId: context.conversationId,
          fieldKey,
          replyText: pendingReply,
        });
        collectedData[fieldKey] = recordedValue;
        pendingReply = undefined;
        break;
      }

      case "buttons":
      case "list_message": {
        const choices = node.type === "buttons" ? node.data.buttons : node.data.items;
        const text = node.data.text;
        if (!text || !choices || choices.length === 0) {
          throw new Error(`"${node.type === "buttons" ? "Buttons" : "List Message"}" block (${node.id}) is not fully configured.`);
        }
        if (pendingReply === undefined) {
          await outboundSender.sendText(context.conversationId, composeChoicePrompt(text, node.data.listTitle, choices));
          return { outcome: "paused", nodeId: node.id, collectedData };
        }
        const match = matchChoice(pendingReply, choices);
        if (!match) {
          // No option matched -- re-prompt and stay paused here rather than
          // guessing a destination. Bounded by the customer's next reply,
          // not by anything in this walk (each attempt is a separate
          // inbound delivery/webhook call).
          await outboundSender.sendText(context.conversationId, composeChoicePrompt(text, node.data.listTitle, choices));
          return { outcome: "paused", nodeId: node.id, collectedData };
        }
        pendingReply = undefined;
        leavingPort = match.id;
        break;
      }

      case "update_stage": {
        const stage = node.data.stage;
        if (!stage) {
          throw new Error(`"Update Stage" block (${node.id}) has no stage configured.`);
        }
        await updateLeadStage(supabase, context.conversationId, stage);
        break;
      }

      case "assign_staff": {
        if (node.data.assignmentMode === "auto_team") {
          // No assignment strategy for "Automatic / Team" exists anywhere in
          // this codebase (confirmed: lib/assignment-logic.ts's
          // lowestWorkloadStaffId() is a human-facing *suggestion* helper for
          // the manual-assign UI, never used to commit an assignment on its
          // own -- using it here would mean this function silently choosing
          // "least workload" as the automatic strategy, which is exactly the
          // kind of invented business semantics this phase was told not to
          // introduce). Fails the run/session closed with a specific,
          // actionable reason instead.
          throw new Error(
            `"Assign Staff" block (${node.id}) is set to Automatic / Team, which has no defined runtime behavior yet. Use "Specific Staff Member" until an assignment strategy is decided.`
          );
        }
        const staffId = node.data.staffId;
        if (!staffId) {
          throw new Error(`"Assign Staff" block (${node.id}) has no staff member configured.`);
        }
        await assignStaffSpecific(supabase, context.conversationId, staffId);
        break;
      }

      case "create_follow_up": {
        const title = node.data.followUpTitle;
        if (!title) {
          throw new Error(`"Create Follow-up" block (${node.id}) has no title configured.`);
        }
        await createAutomationFollowUp(supabase, {
          conversationId: context.conversationId,
          title,
          dueHours: node.data.followUpDueHours ?? DEFAULT_FOLLOW_UP_DUE_HOURS,
        });
        break;
      }

      default:
        throw new Error(`Automation flow contains an unsupported block type ("${node.type}").`);
    }

    isFirstNode = false;
    const edge = getOutgoingEdge(graph, currentId, leavingPort);
    if (!edge) return { outcome: "completed", collectedData };
    currentId = edge.target;
  }
}

// Fresh match: walk starts at the graph's trigger node with no reply to
// consume, leaving via the "matched" port -- not caught here, so a
// missing/unreadable graph propagates to trigger.ts's catch and marks the
// run "failed" with a clear reason.
export async function startAndAdvance(
  supabase: SupabaseClient<Database>,
  rawActions: unknown,
  triggerNodeId: string,
  context: ExecutionContext,
  outboundSender: OutboundSender,
  startPort: string = "matched"
): Promise<WalkOutcome> {
  const graph = parseBuilderGraph(rawActions);
  return walk(supabase, graph, triggerNodeId, startPort, undefined, context, outboundSender);
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
  const graph = parseBuilderGraph(rawActions);
  return walk(supabase, graph, currentNodeId, NEXT_PORT, replyText, context, outboundSender);
}

// Exposed for tests only -- lets Scenario K ("invalid graph rejected before
// execution") and other synthetic tests exercise parseBuilderGraph's own
// throw behavior through the same entry point production code uses,
// without needing a running webhook.
export { parseBuilderGraph };
