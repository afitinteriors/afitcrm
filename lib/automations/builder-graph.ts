// Version 3 of the automations.actions document -- the Automation Builder's
// graph. This extends the same stored document and the same visual editor
// that lib/automations/graph-schema.ts (v2) describes; it is not a second
// storage model. v2 graphs are read by converting them here.
//
// Execution safety: the live executor (lib/automations/executor.ts, via
// graph-schema.ts parseAutomationGraph) only accepts version 2 and throws
// for anything else, so a version 3 flow can never run. The save action
// additionally forces status 'draft' and refuses to edit a live row.
// Nothing in this file sends, enables or executes anything.

import { parseAutomationGraph, type AutomationGraphV2 } from "@/lib/automations/graph-schema";
import { CAPTURABLE_LEAD_FIELDS, type CapturableLeadField } from "@/lib/automations/graph-schema";
import { PIPELINE_STATUSES } from "@/lib/constants";
import type { LeadStatus } from "@/lib/supabase/types";

export const BUILDER_GRAPH_VERSION = 3;
export const MAX_BUILDER_NODES = 150;
const MAX_TEXT_LENGTH = 4000;
const MAX_KEYWORDS = 20;
const MAX_BUTTONS = 3;
const MAX_LIST_ITEMS = 10;
const MIN_BRANCH_PATHS = 2;
const MAX_BRANCH_PATHS = 5;
const MAX_RETRY_LIMIT = 3;

export const TRIGGER_TYPES = [
  "trigger", // Keyword Trigger (keeps the v2 id)
  "new_message",
  "meta_lead",
  "button_clicked",
  "list_selection",
  "conversation_start",
] as const;

export const MESSAGE_TYPES = [
  "send_text",
  "send_image",
  "send_video",
  "send_audio",
  "send_document",
  "send_template",
] as const;

export const ACTION_TYPES = [
  "ask_question",
  "buttons",
  "list_message",
  "save_to_crm",
  "update_stage",
  "assign_staff",
  "add_tag",
  "create_follow_up",
  "notify_team",
  "create_or_link_lead",
  "end_flow",
] as const;

export const LOGIC_TYPES = ["condition", "branch", "delay", "jump_to"] as const;

export const BUILDER_NODE_TYPES = [...TRIGGER_TYPES, ...MESSAGE_TYPES, ...ACTION_TYPES, ...LOGIC_TYPES] as const;
export type BuilderNodeType = (typeof BUILDER_NODE_TYPES)[number];

export type BuilderCategory = "trigger" | "message" | "action" | "logic";

export type BuilderNodeDefinition = {
  type: BuilderNodeType;
  category: BuilderCategory;
  label: string;
  description: string;
};

export const BUILDER_NODE_DEFINITIONS: Record<BuilderNodeType, BuilderNodeDefinition> = {
  trigger: { type: "trigger", category: "trigger", label: "Keyword Trigger", description: "Starts when a message matches a keyword." },
  new_message: { type: "new_message", category: "trigger", label: "New Message", description: "Starts on any new inbound message." },
  meta_lead: { type: "meta_lead", category: "trigger", label: "Meta Lead", description: "Starts from a Meta ad lead." },
  button_clicked: { type: "button_clicked", category: "trigger", label: "Button Clicked", description: "Starts when a button is tapped." },
  list_selection: { type: "list_selection", category: "trigger", label: "List Selection", description: "Starts when a list option is picked." },
  conversation_start: { type: "conversation_start", category: "trigger", label: "Conversation Start", description: "Starts a new conversation." },
  send_text: { type: "send_text", category: "message", label: "Send Text", description: "Sends a text message." },
  send_image: { type: "send_image", category: "message", label: "Send Image", description: "Sends an image from the media library." },
  send_video: { type: "send_video", category: "message", label: "Send Video", description: "Sends a video from the media library." },
  send_audio: { type: "send_audio", category: "message", label: "Send Audio / Voice", description: "Sends an audio or voice note." },
  send_document: { type: "send_document", category: "message", label: "Send Document", description: "Sends a document file." },
  send_template: { type: "send_template", category: "message", label: "Send Template", description: "Sends a pre-approved message template." },
  ask_question: { type: "ask_question", category: "action", label: "Ask Question", description: "Asks a question and routes valid or fallback answers." },
  buttons: { type: "buttons", category: "action", label: "Buttons", description: "Sends a message with up to 3 buttons, each with its own destination." },
  list_message: { type: "list_message", category: "action", label: "List Message", description: "Sends a list of options, each with its own destination." },
  save_to_crm: { type: "save_to_crm", category: "action", label: "Save to CRM", description: "Stores a value in a lead field." },
  update_stage: { type: "update_stage", category: "action", label: "Update Stage", description: "Moves the lead to a pipeline stage." },
  assign_staff: { type: "assign_staff", category: "action", label: "Assign Staff", description: "Assigns the lead to a staff member." },
  add_tag: { type: "add_tag", category: "action", label: "Add Tag", description: "Adds a tag to the lead." },
  create_follow_up: { type: "create_follow_up", category: "action", label: "Create Follow-up", description: "Creates a follow-up task." },
  notify_team: { type: "notify_team", category: "action", label: "Notify Team", description: "Sends an internal team notification." },
  create_or_link_lead: { type: "create_or_link_lead", category: "action", label: "Create/Update Lead", description: "Creates a new lead or links this conversation to one." },
  end_flow: { type: "end_flow", category: "action", label: "End Flow", description: "Ends this flow." },
  condition: { type: "condition", category: "logic", label: "Condition", description: "Routes Yes or No based on a field or reply." },
  branch: { type: "branch", category: "logic", label: "Branch", description: "Splits the flow into labelled paths." },
  delay: { type: "delay", category: "logic", label: "Delay / Wait", description: "Waits before continuing." },
  jump_to: { type: "jump_to", category: "logic", label: "Jump to Step", description: "Continues at another step in this flow." },
};

export const BUILDER_CATEGORY_LABELS: Record<BuilderCategory, string> = {
  trigger: "Triggers",
  message: "Messages",
  action: "Actions",
  logic: "Logic",
};

export type ChoiceItem = { id: string; label: string; description?: string };
export type AnswerType = "text" | "number" | "phone" | "choice";
export type MatchType = "contains" | "exact" | "starts_with";
export type ValueSource = "customer_reply" | "fixed";
export type ConditionOperator = "equals" | "contains" | "is_empty" | "is_not_empty";
export type DelayUnit = "minutes" | "hours" | "days";

export type BuilderNodeData = {
  label?: string; // block name shown on the canvas
  text?: string; // message / question / body text
  keywords?: string[];
  matchType?: MatchType;
  caseSensitive?: boolean;
  mediaAssetId?: string; // image/video, from automation_media
  mediaName?: string; // audio/document: no backing library yet (mock selection)
  caption?: string;
  templateName?: string;
  answerType?: AnswerType;
  required?: boolean;
  retryLimit?: number;
  buttons?: ChoiceItem[];
  listTitle?: string;
  items?: ChoiceItem[];
  fieldKey?: CapturableLeadField;
  valueSource?: ValueSource;
  fixedValue?: string;
  stage?: LeadStatus;
  staffId?: string;
  tag?: string;
  followUpTitle?: string;
  followUpDueHours?: number;
  conditionField?: CapturableLeadField | "customer_reply";
  conditionOperator?: ConditionOperator;
  conditionValue?: string;
  branchPaths?: ChoiceItem[];
  delayAmount?: number;
  delayUnit?: DelayUnit;
  jumpTargetId?: string;
};

export type BuilderNode = {
  id: string;
  type: BuilderNodeType;
  position: { x: number; y: number };
  data: BuilderNodeData;
};

export type BuilderEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string; // which output port of the source this connection leaves from
};

export type BuilderGraph = {
  version: typeof BUILDER_GRAPH_VERSION;
  meta: { publishedAt: string | null };
  nodes: BuilderNode[];
  edges: BuilderEdge[];
};

export type PortDef = { id: string; label: string };
export const NEXT_PORT = "next";

const TRIGGER_SET = new Set<string>(TRIGGER_TYPES);
export function isTriggerType(type: BuilderNodeType): boolean {
  return TRIGGER_SET.has(type);
}

// Output ports for a node. Choice-based nodes get one port per option, keyed
// by the option's stable id, so a relabel never breaks its connection.
export function getPorts(type: BuilderNodeType, data: BuilderNodeData = {}): PortDef[] {
  switch (type) {
    case "trigger":
      return [
        { id: "matched", label: "Matched" },
        { id: "not_matched", label: "Not matched" },
      ];
    case "ask_question":
      return [
        { id: NEXT_PORT, label: "Valid answer" },
        { id: "fallback", label: "Fallback" },
      ];
    case "buttons":
      return (data.buttons ?? []).map((b) => ({ id: b.id, label: b.label || "Button" }));
    case "list_message":
      return (data.items ?? []).map((i) => ({ id: i.id, label: i.label || "Option" }));
    case "condition":
      return [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ];
    case "branch":
      return (data.branchPaths ?? []).map((p) => ({ id: p.id, label: p.label || "Path" }));
    case "end_flow":
    case "jump_to":
      return [];
    default:
      return [{ id: NEXT_PORT, label: "Next" }];
  }
}

export function getNodeName(node: BuilderNode): string {
  return node.data.label?.trim() || BUILDER_NODE_DEFINITIONS[node.type].label;
}

export class BuilderGraphError extends Error {}

export function buildEmptyBuilderGraph(): BuilderGraph {
  return {
    version: BUILDER_GRAPH_VERSION,
    meta: { publishedAt: null },
    nodes: [{ id: "trigger-1", type: "trigger", position: { x: 60, y: 160 }, data: { keywords: [] } }],
    edges: [],
  };
}

// Reads a stored automations.actions value into a builder graph. v2 graphs
// are converted (their legacy node types map onto the v3 vocabulary); v3 is
// strictly checked. Anything unreadable throws BuilderGraphError rather than
// being silently dropped -- a silently dropped block would change the flow.
export function parseBuilderGraph(raw: unknown): BuilderGraph {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && (raw as { version?: unknown }).version === 2) {
    let v2: AutomationGraphV2;
    try {
      v2 = parseAutomationGraph(raw);
    } catch (err) {
      throw new BuilderGraphError(err instanceof Error ? err.message : "Flow data was invalid.");
    }
    return convertV2(v2);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BuilderGraphError("Flow data is missing or malformed.");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== BUILDER_GRAPH_VERSION) {
    throw new BuilderGraphError(`Unsupported flow format version: ${String(obj.version)}.`);
  }
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges)) {
    throw new BuilderGraphError("Flow data is missing its blocks or connections.");
  }
  if (obj.nodes.length > MAX_BUILDER_NODES) {
    throw new BuilderGraphError(`A flow can have at most ${MAX_BUILDER_NODES} blocks.`);
  }

  const meta = obj.meta as { publishedAt?: unknown } | undefined;
  const publishedAt = typeof meta?.publishedAt === "string" ? meta.publishedAt : null;

  const nodes: BuilderNode[] = [];
  const nodeIds = new Set<string>();
  for (const rawNode of obj.nodes) {
    const n = rawNode as Record<string, unknown>;
    if (!n || typeof n !== "object" || typeof n.id !== "string" || !n.id) {
      throw new BuilderGraphError("A block in this flow has no id.");
    }
    if (nodeIds.has(n.id)) throw new BuilderGraphError("This flow has two blocks with the same id.");
    if (typeof n.type !== "string" || !(BUILDER_NODE_TYPES as readonly string[]).includes(n.type)) {
      throw new BuilderGraphError(`This flow contains an unknown block type: ${String(n.type)}.`);
    }
    const type = n.type as BuilderNodeType;
    const pos = (n.position ?? {}) as { x?: unknown; y?: unknown };
    nodeIds.add(n.id);
    nodes.push({
      id: n.id,
      type,
      position: { x: typeof pos.x === "number" ? pos.x : 0, y: typeof pos.y === "number" ? pos.y : 0 },
      data: sanitizeData(type, n.data),
    });
  }

  const edges: BuilderEdge[] = [];
  const edgeIds = new Set<string>();
  const usedPorts = new Set<string>();
  for (const rawEdge of obj.edges) {
    const e = rawEdge as Record<string, unknown>;
    if (!e || typeof e !== "object" || typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string") {
      throw new BuilderGraphError("A connection in this flow is malformed.");
    }
    if (edgeIds.has(e.id)) throw new BuilderGraphError("This flow has two connections with the same id.");
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      throw new BuilderGraphError("This flow has a connection to a block that doesn't exist.");
    }
    if (e.source === e.target) throw new BuilderGraphError("A block can't connect to itself.");
    const sourceHandle = typeof e.sourceHandle === "string" && e.sourceHandle ? e.sourceHandle : NEXT_PORT;
    const portKey = `${e.source}::${sourceHandle}`;
    if (usedPorts.has(portKey)) throw new BuilderGraphError("An output can only be connected once.");
    usedPorts.add(portKey);
    edgeIds.add(e.id);
    edges.push({ id: e.id, source: e.source, target: e.target, sourceHandle });
  }

  return { version: BUILDER_GRAPH_VERSION, meta: { publishedAt }, nodes, edges };
}

function convertV2(graph: AutomationGraphV2): BuilderGraph {
  const nodes: BuilderNode[] = graph.nodes.map((n) => {
    const legacy = n.data ?? {};
    const isCapture = n.type === "capture_lead_field";
    const type: BuilderNodeType = isCapture
      ? "save_to_crm"
      : n.type === "end"
        ? "end_flow"
        : (n.type as BuilderNodeType);
    const data: BuilderNodeData = {};
    if (legacy.text) data.text = legacy.text;
    if (legacy.mediaAssetId) data.mediaAssetId = legacy.mediaAssetId;
    if (legacy.fieldKey) data.fieldKey = legacy.fieldKey;
    if (isCapture) data.valueSource = "customer_reply";
    if (type === "trigger") data.keywords = [];
    return { id: n.id, type, position: n.position, data };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: BuilderEdge[] = graph.edges.map((e) => {
    const source = byId.get(e.source);
    const sourceHandle = source ? getPorts(source.type, source.data)[0]?.id ?? NEXT_PORT : NEXT_PORT;
    return { id: e.id, source: e.source, target: e.target, sourceHandle };
  });
  return { version: BUILDER_GRAPH_VERSION, meta: { publishedAt: null }, nodes, edges };
}

const STRING_KEYS = [
  "label", "text", "mediaAssetId", "mediaName", "caption", "templateName", "fixedValue",
  "staffId", "tag", "followUpTitle", "jumpTargetId", "conditionValue", "listTitle",
] as const;
const ENUMS: Record<string, readonly string[]> = {
  matchType: ["contains", "exact", "starts_with"],
  answerType: ["text", "number", "phone", "choice"],
  valueSource: ["customer_reply", "fixed"],
  delayUnit: ["minutes", "hours", "days"],
  conditionOperator: ["equals", "contains", "is_empty", "is_not_empty"],
  fieldKey: CAPTURABLE_LEAD_FIELDS.map((f) => f.value),
  conditionField: [...CAPTURABLE_LEAD_FIELDS.map((f) => f.value), "customer_reply"],
  stage: PIPELINE_STATUSES,
};

// Keeps only the keys a block type can use, and fails loudly on a wrong
// type or an out-of-range value. The builder writes these keys; anything
// else in stored data is dropped, never executed or displayed.
function sanitizeData(type: BuilderNodeType, rawData: unknown): BuilderNodeData {
  if (rawData === undefined || rawData === null) return {};
  if (typeof rawData !== "object" || Array.isArray(rawData)) {
    throw new BuilderGraphError(`Block settings for "${BUILDER_NODE_DEFINITIONS[type].label}" are malformed.`);
  }
  const raw = rawData as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const where = BUILDER_NODE_DEFINITIONS[type].label;

  for (const key of STRING_KEYS) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== "string") throw new BuilderGraphError(`"${where}" has an invalid ${key}.`);
    if (value.length > MAX_TEXT_LENGTH) throw new BuilderGraphError(`"${where}" text is too long.`);
    out[key] = value;
  }
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new BuilderGraphError(`"${where}" has an invalid ${key}.`);
    }
    out[key] = value;
  }
  for (const key of ["caseSensitive", "required"] as const) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") throw new BuilderGraphError(`"${where}" has an invalid ${key}.`);
    out[key] = value;
  }
  const numbers: [string, number, number][] = [
    ["retryLimit", 0, MAX_RETRY_LIMIT],
    ["followUpDueHours", 0, 8760],
    ["delayAmount", 0, 10000],
  ];
  for (const [key, min, max] of numbers) {
    const value = raw[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new BuilderGraphError(`"${where}" has an invalid ${key}.`);
    }
    out[key] = value;
  }
  if (raw.keywords !== undefined) {
    if (!Array.isArray(raw.keywords) || raw.keywords.length > MAX_KEYWORDS || raw.keywords.some((k) => typeof k !== "string")) {
      throw new BuilderGraphError(`"${where}" has invalid keywords.`);
    }
    out.keywords = raw.keywords;
  }
  out.buttons = sanitizeChoices(raw.buttons, MAX_BUTTONS, where, "buttons");
  out.items = sanitizeChoices(raw.items, MAX_LIST_ITEMS, where, "items");
  out.branchPaths = sanitizeChoices(raw.branchPaths, MAX_BRANCH_PATHS, where, "branch paths");

  const cleaned: BuilderNodeData = {};
  for (const [key, value] of Object.entries(out)) {
    if (value === undefined) continue;
    (cleaned as Record<string, unknown>)[key] = value;
  }
  return cleaned;
}

function sanitizeChoices(raw: unknown, max: number, where: string, what: string): ChoiceItem[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > max) throw new BuilderGraphError(`"${where}" has invalid ${what}.`);
  return raw.map((item) => {
    const c = item as Record<string, unknown>;
    if (!c || typeof c !== "object" || typeof c.id !== "string" || typeof c.label !== "string") {
      throw new BuilderGraphError(`"${where}" has an invalid ${what} entry.`);
    }
    if (c.label.length > MAX_TEXT_LENGTH) throw new BuilderGraphError(`"${where}" has a ${what} label that is too long.`);
    const choice: ChoiceItem = { id: c.id, label: c.label };
    if (typeof c.description === "string") choice.description = c.description;
    return choice;
  });
}

// ---- Publish validation -----------------------------------------------------
// Full checks, run only when Publish is pressed (client for feedback, server
// before writing). Save Draft never blocks on these -- drafts may be
// incomplete. Nothing here activates or executes a flow.

export type FlowIssueCode =
  | "missing_trigger"
  | "missing_config"
  | "empty_keyword"
  | "empty_message"
  | "button_no_destination"
  | "broken_connection"
  | "orphan_node"
  | "missing_outgoing";

export type FlowIssue = { code: FlowIssueCode; nodeId: string | null; message: string };

export function validateBuilderGraph(graph: BuilderGraph): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const push = (code: FlowIssueCode, node: BuilderNode | null, message: string) =>
    issues.push({ code, nodeId: node?.id ?? null, message });

  if (!graph.nodes.some((n) => isTriggerType(n.type))) {
    push("missing_trigger", null, "Add a trigger block to start this flow.");
  }

  const validEdges = graph.edges.filter((e) => {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (!source || !target) return false;
    if (isTriggerType(target.type)) return false;
    return getPorts(source.type, source.data).some((p) => p.id === e.sourceHandle);
  });
  for (const edge of graph.edges) {
    if (validEdges.includes(edge)) continue;
    const source = byId.get(edge.source);
    if (source) {
      push("broken_connection", source, `"${getNodeName(source)}" has a connection that no longer leads anywhere. Reconnect or remove it.`);
    }
  }

  const jumpTargets = new Set(graph.nodes.map((n) => n.data.jumpTargetId).filter((id): id is string => !!id));
  const incoming = new Set(validEdges.map((e) => e.target));

  for (const node of graph.nodes) {
    const name = getNodeName(node);

    for (const port of getPorts(node.type, node.data)) {
      if (validEdges.some((e) => e.source === node.id && e.sourceHandle === port.id)) continue;
      if (node.type === "buttons" || node.type === "list_message") {
        push("button_no_destination", node, `"${name}": "${port.label}" has no destination.`);
      } else {
        push("missing_outgoing", node, `"${name}" has no path out on "${port.label}".`);
      }
    }

    if (!isTriggerType(node.type) && !incoming.has(node.id) && !jumpTargets.has(node.id)) {
      push("orphan_node", node, `"${name}" isn't connected to the flow.`);
    }

    for (const message of configProblems(node, graph)) {
      push(message.code, node, `"${name}": ${message.text}`);
    }
  }

  return issues;
}

function configProblems(node: BuilderNode, graph: BuilderGraph): { code: FlowIssueCode; text: string }[] {
  const d = node.data;
  const problems: { code: FlowIssueCode; text: string }[] = [];
  const missing = (text: string) => problems.push({ code: "missing_config", text });
  const emptyText = (text: string) => problems.push({ code: "empty_message", text });
  const blank = (value: string | undefined) => !value || value.trim().length === 0;

  switch (node.type) {
    case "trigger": {
      const keywords = d.keywords ?? [];
      if (keywords.length === 0) problems.push({ code: "empty_keyword", text: "add at least one keyword." });
      else if (keywords.some((k) => blank(k))) problems.push({ code: "empty_keyword", text: "a keyword is empty." });
      break;
    }
    case "send_text":
    case "notify_team":
      if (blank(d.text)) emptyText("message text is empty.");
      break;
    case "ask_question":
      if (blank(d.text)) emptyText("question text is empty.");
      break;
    case "buttons":
      if (blank(d.text)) emptyText("message text is empty.");
      if (!d.buttons || d.buttons.length === 0) missing("add at least one button.");
      else if (d.buttons.some((b) => blank(b.label))) missing("a button has no label.");
      break;
    case "list_message":
      if (blank(d.text)) emptyText("message text is empty.");
      if (blank(d.listTitle)) missing("set the list button label.");
      if (!d.items || d.items.length === 0) missing("add at least one list option.");
      else if (d.items.some((i) => blank(i.label))) missing("a list option has no label.");
      break;
    case "send_image":
    case "send_video":
      if (!d.mediaAssetId) missing("choose a media file.");
      break;
    case "send_audio":
    case "send_document":
      if (blank(d.mediaName)) missing("choose a file.");
      break;
    case "send_template":
      if (blank(d.templateName)) missing("choose a template.");
      break;
    case "save_to_crm":
      if (!d.fieldKey) missing("choose a CRM field.");
      if (d.valueSource === "fixed" && blank(d.fixedValue)) missing("enter the fixed value to save.");
      break;
    case "update_stage":
      if (!d.stage) missing("choose a stage.");
      break;
    case "assign_staff":
      if (blank(d.staffId)) missing("choose a staff member.");
      break;
    case "add_tag":
      if (blank(d.tag)) missing("enter a tag.");
      break;
    case "create_follow_up":
      if (blank(d.followUpTitle)) missing("enter a follow-up title.");
      break;
    case "condition":
      if (!d.conditionField) missing("choose what to check.");
      if (d.conditionOperator !== "is_empty" && d.conditionOperator !== "is_not_empty" && blank(d.conditionValue)) {
        missing("enter the value to compare against.");
      }
      break;
    case "branch":
      if (!d.branchPaths || d.branchPaths.length < MIN_BRANCH_PATHS) missing(`add at least ${MIN_BRANCH_PATHS} paths.`);
      else if (d.branchPaths.some((p) => blank(p.label))) missing("a branch path has no label.");
      break;
    case "delay":
      if (!d.delayAmount || d.delayAmount <= 0) missing("enter how long to wait.");
      break;
    case "jump_to": {
      const target = d.jumpTargetId ? graph.nodes.find((n) => n.id === d.jumpTargetId) : undefined;
      if (!target || target.id === node.id) missing("choose the step to jump to.");
      break;
    }
    default:
      break;
  }
  return problems;
}
