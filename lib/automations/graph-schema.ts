// Versioned schema for automations.actions (jsonb) -- the visual flow graph
// a service's automation represents. Version 1
// (lib/automations/action-schema.ts, {version:1, steps:[...]}) was Phase 3's
// flat single-action format; it is kept in place, not deleted, but is no
// longer written or executed as of this phase. Zero live automations
// depended on it when this phase started.
//
// Only three node types have any real backend meaning right now:
//   trigger              -- structural, exactly one per graph, no config.
//                            Documents where the flow starts (the keyword
//                            match that already happens upstream in
//                            matching.ts/trigger.ts, Phase 2) -- it has no
//                            execution effect of its own.
//   create_or_link_lead  -- the one real, executable CRM action (Phase 3).
//   end                  -- structural, purely visual, no backend effect.
// Every other node type below is a deliberately non-executable "planned"
// placeholder, shown disabled in the builder's palette so the intended
// future shape of a conversational flow is visible without letting an
// admin configure something that would silently do nothing once saved.
//
// This phase's execution model is NOT a graph walk -- edges are
// visual/planning only and do not yet affect execution order. That
// requires multi-step conversational execution (session persistence,
// resuming after a customer's reply), which is a separate, later, approved
// phase. All that matters today is whether the graph contains an enabled
// create_or_link_lead node at all.

export type AutomationNodeType =
  | "trigger"
  | "create_or_link_lead"
  | "end"
  | "send_text"
  | "send_image"
  | "send_video"
  | "ask_question"
  | "capture_lead_field"
  | "condition";

// The fixed, non-developer field selector for capture_lead_field -- grounded
// in real, existing leads columns (lib/supabase/types.ts LeadRow), nothing
// invented. Deliberately excludes phone (the conversation's own identity
// key, never customer-overwritable) and service_required (already set by
// create_or_link_lead) and expected_start_date (free-text WhatsApp replies
// aren't safely parseable into a real date without inventing NLP -- timing
// answers go through "notes" instead).
export type CapturableLeadField = "customer_name" | "location" | "project_type" | "estimated_sqft" | "notes";

export const CAPTURABLE_LEAD_FIELDS: { value: CapturableLeadField; label: string }[] = [
  { value: "customer_name", label: "Customer name" },
  { value: "location", label: "Location" },
  { value: "project_type", label: "Project type" },
  { value: "estimated_sqft", label: "Area / sqft" },
  { value: "notes", label: "Notes (general)" },
];

export type AutomationGraphNodeData = {
  fieldKey?: CapturableLeadField;
  text?: string;
  mediaAssetId?: string;
};

export type NodeDefinition = {
  type: AutomationNodeType;
  label: string;
  description: string;
  enabled: boolean;
  disabledReason?: string;
};

const CONVERSATIONAL_ENGINE_REASON = "Requires multi-step conversational execution, planned for a future phase.";

export const NODE_DEFINITIONS: NodeDefinition[] = [
  {
    type: "trigger",
    label: "Trigger",
    description: "Starts when an inbound WhatsApp message matches one of this service's active keywords.",
    enabled: true,
  },
  {
    type: "create_or_link_lead",
    label: "Create/Update Lead",
    description: "Creates a new lead or links this conversation to an existing lead matched by phone number.",
    enabled: true,
  },
  {
    type: "end",
    label: "End",
    description: "Marks the end of this flow. Has no effect on execution -- for planning clarity only.",
    enabled: true,
  },
  {
    type: "send_text",
    label: "Send Text",
    description: "Sends a text message to the customer, then continues to the next block.",
    enabled: true,
  },
  {
    type: "send_image",
    label: "Send Image",
    description: "Sends an image from the media library to the customer, then continues to the next block. No caption -- use a Send Text block after this for follow-up text.",
    enabled: true,
  },
  {
    type: "send_video",
    label: "Send Video",
    description: "Sends a video from the media library to the customer, then continues to the next block. No caption -- use a Send Text block after this for follow-up text.",
    enabled: true,
  },
  {
    type: "ask_question",
    label: "Ask Question",
    description: "Sends a question to the customer, then continues -- pair it with a Capture Lead Field block to wait for and store the reply.",
    enabled: true,
  },
  {
    type: "capture_lead_field",
    label: "Capture Lead Field",
    description: "Waits for the customer's next reply and stores it against a lead field. A technical wait/store step -- it does not send anything to the customer.",
    enabled: true,
  },
  { type: "condition", label: "Condition", description: "Branch the flow based on a collected value.", enabled: false, disabledReason: CONVERSATIONAL_ENGINE_REASON },
];

export const ENABLED_NODE_TYPES: AutomationNodeType[] = NODE_DEFINITIONS.filter((d) => d.enabled).map((d) => d.type);

export function getNodeDefinition(type: AutomationNodeType): NodeDefinition {
  const def = NODE_DEFINITIONS.find((d) => d.type === type);
  if (!def) throw new Error(`Unknown automation node type: ${type}`);
  return def;
}

export type AutomationGraphNode = {
  id: string;
  type: AutomationNodeType;
  position: { x: number; y: number };
  data?: AutomationGraphNodeData;
};

export type AutomationGraphEdge = {
  id: string;
  source: string;
  target: string;
};

export type AutomationGraphV2 = {
  version: 2;
  nodes: AutomationGraphNode[];
  edges: AutomationGraphEdge[];
};

export class UnsupportedAutomationVersionError extends Error {}

// Throws rather than silently returning "no actions" for anything that
// isn't a valid v2 graph -- a corrupted or unrecognized graph on an ACTIVE
// automation must surface as a clearly failed automation_run, never as
// silent no-op execution. This deliberately reverses Phase 3's more
// permissive parseAutomationActions() (lib/automations/action-schema.ts),
// which was an acceptable default when the only action was one optional
// checkbox, but would hide a real problem for a whole flow.
export function parseAutomationGraph(raw: unknown): AutomationGraphV2 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UnsupportedAutomationVersionError("Automation actions payload is missing or malformed.");
  }
  const obj = raw as Record<string, unknown>;

  if (obj.version === 1) {
    throw new UnsupportedAutomationVersionError(
      "This automation uses the legacy v1 action format, which is no longer executed. Open it in the flow builder and save it to upgrade."
    );
  }
  if (obj.version !== 2) {
    throw new UnsupportedAutomationVersionError(`Unsupported automation actions version: ${String(obj.version)}`);
  }
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
    throw new UnsupportedAutomationVersionError("Automation actions graph is missing nodes or edges.");
  }

  const knownTypes = new Set(NODE_DEFINITIONS.map((d) => d.type));
  const validFieldKeys = new Set(CAPTURABLE_LEAD_FIELDS.map((f) => f.value));
  const nodes: AutomationGraphNode[] = [];
  for (const raw of obj.nodes) {
    if (!raw || typeof raw !== "object") continue;
    const n = raw as Record<string, unknown>;
    if (typeof n.id !== "string" || typeof n.type !== "string" || !knownTypes.has(n.type as AutomationNodeType)) continue;
    const position = n.position as { x?: unknown; y?: unknown } | undefined;

    let data: AutomationGraphNodeData | undefined;
    const rawData = n.data as Record<string, unknown> | undefined;
    if (rawData && typeof rawData === "object") {
      if (typeof rawData.fieldKey === "string" && validFieldKeys.has(rawData.fieldKey as CapturableLeadField)) {
        data = { ...data, fieldKey: rawData.fieldKey as CapturableLeadField };
      }
      if (typeof rawData.text === "string" && rawData.text.trim().length > 0) {
        data = { ...data, text: rawData.text };
      }
      if (typeof rawData.mediaAssetId === "string" && rawData.mediaAssetId.trim().length > 0) {
        data = { ...data, mediaAssetId: rawData.mediaAssetId };
      }
    }

    nodes.push({
      id: n.id,
      type: n.type as AutomationNodeType,
      position: {
        x: typeof position?.x === "number" ? position.x : 0,
        y: typeof position?.y === "number" ? position.y : 0,
      },
      ...(data ? { data } : {}),
    });
  }

  const edges: AutomationGraphEdge[] = [];
  for (const raw of obj.edges) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string") continue;
    edges.push({ id: e.id, source: e.source, target: e.target });
  }

  return { version: 2, nodes, edges };
}

export function buildEmptyGraph(): AutomationGraphV2 {
  return {
    version: 2,
    nodes: [{ id: "trigger-1", type: "trigger", position: { x: 60, y: 160 } }],
    edges: [],
  };
}

// The one graph lookup the session-state foundation needs: where a new
// session starts. This does not walk the graph, it only locates the single
// required trigger node.
export function findTriggerNodeId(graph: AutomationGraphV2): string | null {
  return graph.nodes.find((n) => n.type === "trigger")?.id ?? null;
}

export function getOutgoingEdges(graph: AutomationGraphV2, nodeId: string): AutomationGraphEdge[] {
  return graph.edges.filter((e) => e.source === nodeId);
}

// Save-time quality gate, used only by saveAutomationGraph (never by the
// executor's own read path, which stays a permissive structural parser).
// Sequential traversal requires each node have at most one outgoing edge --
// enforced here with a clear, specific message rather than silently
// dropping the extra connection or guessing which one wins.
export function validateGraphForSave(graph: AutomationGraphV2): string[] {
  const errors: string[] = [];

  const outgoingCounts = new Map<string, number>();
  for (const edge of graph.edges) {
    outgoingCounts.set(edge.source, (outgoingCounts.get(edge.source) ?? 0) + 1);
  }
  for (const [nodeId, count] of outgoingCounts) {
    if (count > 1) {
      const node = graph.nodes.find((n) => n.id === nodeId);
      const label = node ? getNodeDefinition(node.type).label : "A block";
      errors.push(`"${label}" has more than one connection out of it -- each block can only lead to one next step.`);
    }
  }

  for (const node of graph.nodes) {
    if (node.type === "capture_lead_field" && !node.data?.fieldKey) {
      errors.push(`"Capture Lead Field" needs a field selected before this flow can be saved.`);
    }
    if ((node.type === "send_text" || node.type === "ask_question") && !node.data?.text?.trim()) {
      const label = getNodeDefinition(node.type).label;
      errors.push(`"${label}" needs message text before this flow can be saved.`);
    }
    if ((node.type === "send_image" || node.type === "send_video") && !node.data?.mediaAssetId) {
      const label = getNodeDefinition(node.type).label;
      errors.push(`"${label}" needs a media file selected before this flow can be saved.`);
    }
  }

  return errors;
}
