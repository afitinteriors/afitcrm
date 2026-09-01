import type { Node, Edge } from "@xyflow/react";
import type { FollowUpType, LeadStatus } from "@/lib/supabase/types";

// C5 UI prototype (no backend, no schema). Every type here is invented for
// this builder only -- none of it maps to a real table yet. Services are a
// small local placeholder list, not a real "services" concept in the schema.
export const AUTOMATION_SERVICES = [
  "Gypsum Plastering",
  "Interior Design",
  "False Ceiling",
  "Painting",
  "Waterproofing",
] as const;

export type AutomationService = (typeof AUTOMATION_SERVICES)[number];

export type AutomationStatus = "draft" | "active";

export type NodeCategory = "trigger" | "filter" | "action" | "message" | "flow";

export type NodeKind =
  | "trigger_new_message"
  | "trigger_customer_reply"
  | "trigger_lead_created"
  | "trigger_stage_changed"
  | "trigger_followup_due"
  | "filter_detect_service"
  | "filter_keyword_match"
  | "filter_message_contains"
  | "filter_lead_source"
  | "filter_lead_stage"
  | "filter_assigned_state"
  | "filter_location"
  | "filter_qualification_answer"
  | "action_create_link_lead"
  | "action_assign_staff"
  | "action_assign_admin"
  | "action_set_stage"
  | "action_add_service"
  | "action_start_followup"
  | "action_stop_automation"
  | "message_text"
  | "message_image"
  | "message_video"
  | "message_file"
  | "message_template"
  | "message_interactive"
  | "message_cta"
  | "flow_delay"
  | "flow_condition"
  | "flow_customer_response"
  | "flow_crosssell"
  | "flow_stop";

export type BlockDefinition = {
  kind: NodeKind;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
};

export const NODE_CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: "Triggers",
  filter: "Service / Filter",
  action: "CRM Actions",
  message: "Messages",
  flow: "Flow",
};

export const MESSAGE_KINDS: NodeKind[] = [
  "message_text",
  "message_image",
  "message_video",
  "message_file",
  "message_template",
  "message_interactive",
  "message_cta",
];

export const MEDIA_MESSAGE_KINDS: NodeKind[] = ["message_image", "message_video", "message_file"];

export const BLOCK_LIBRARY: BlockDefinition[] = [
  // Triggers
  { kind: "trigger_new_message", category: "trigger", label: "New WhatsApp Message", icon: "💬", description: "Fires when a customer sends the first message in a new conversation." },
  { kind: "trigger_customer_reply", category: "trigger", label: "Customer Reply", icon: "↩️", description: "Fires when the customer replies during this journey." },
  { kind: "trigger_lead_created", category: "trigger", label: "Lead Created", icon: "➕", description: "Fires when a lead is created." },
  { kind: "trigger_stage_changed", category: "trigger", label: "Live Stage Changed", icon: "🔄", description: "Fires when a lead's stage changes." },
  { kind: "trigger_followup_due", category: "trigger", label: "Follow-up Due", icon: "⏰", description: "Fires when a follow-up becomes due." },
  // Service / Filter
  { kind: "filter_detect_service", category: "filter", label: "Detect Service", icon: "🎯", description: "Identify which service the customer is asking about." },
  { kind: "filter_keyword_match", category: "filter", label: "Keyword Match", icon: "🔑", description: "Match specific keywords in the message." },
  { kind: "filter_message_contains", category: "filter", label: "Message Contains", icon: "🔎", description: "Check if the message text contains a phrase." },
  { kind: "filter_lead_source", category: "filter", label: "Lead Source", icon: "📡", description: "Branch based on where the lead came from." },
  { kind: "filter_lead_stage", category: "filter", label: "Lead Stage", icon: "🏷️", description: "Branch based on the lead's current stage." },
  { kind: "filter_assigned_state", category: "filter", label: "Assigned State", icon: "👤", description: "Branch based on whether the lead is assigned." },
  { kind: "filter_location", category: "filter", label: "Location", icon: "📍", description: "Branch based on customer location." },
  { kind: "filter_qualification_answer", category: "filter", label: "Qualification Answer", icon: "❓", description: "Branch based on the customer's answer." },
  // CRM Actions
  { kind: "action_create_link_lead", category: "action", label: "Create / Link Lead", icon: "🔗", description: "Create a new lead or link this conversation to one." },
  { kind: "action_assign_staff", category: "action", label: "Assign to Staff", icon: "👷", description: "Assign the lead to a specific staff member." },
  { kind: "action_assign_admin", category: "action", label: "Assign to Admin", icon: "🧑‍💼", description: "Assign the lead to the admin." },
  { kind: "action_set_stage", category: "action", label: "Set Live Stage", icon: "🏷️", description: "Set the lead's live stage." },
  { kind: "action_add_service", category: "action", label: "Add Service", icon: "🧰", description: "Record an additional service of interest on the lead." },
  { kind: "action_start_followup", category: "action", label: "Start Follow-up", icon: "📅", description: "Create a follow-up for this lead." },
  { kind: "action_stop_automation", category: "action", label: "Stop Automation", icon: "⛔", description: "Stop this automation from processing further." },
  // Messages
  { kind: "message_text", category: "message", label: "Text", icon: "📝", description: "Send a text message." },
  { kind: "message_image", category: "message", label: "Image", icon: "🖼️", description: "Send an image." },
  { kind: "message_video", category: "message", label: "Video", icon: "🎥", description: "Send a video." },
  { kind: "message_file", category: "message", label: "File / PDF", icon: "📎", description: "Send a file or PDF." },
  { kind: "message_template", category: "message", label: "Template", icon: "📋", description: "Send an approved WhatsApp template." },
  { kind: "message_interactive", category: "message", label: "Interactive Message", icon: "🧩", description: "Send a message with quick-reply options." },
  { kind: "message_cta", category: "message", label: "CTA Button", icon: "🔘", description: "Send a message with a call-to-action button." },
  // Flow
  { kind: "flow_delay", category: "flow", label: "Delay", icon: "⏱️", description: "Wait before continuing the journey." },
  { kind: "flow_condition", category: "flow", label: "Condition", icon: "🔀", description: "Branch the journey based on a condition." },
  { kind: "flow_customer_response", category: "flow", label: "Customer Response", icon: "💭", description: "Wait for and branch on the customer's reply." },
  { kind: "flow_crosssell", category: "flow", label: "Cross-sell Service", icon: "🔁", description: "Intentionally introduce another service." },
  { kind: "flow_stop", category: "flow", label: "Stop", icon: "🛑", description: "End the journey." },
];

export function getBlockDefinition(kind: NodeKind): BlockDefinition {
  const block = BLOCK_LIBRARY.find((b) => b.kind === kind);
  if (!block) throw new Error(`Unknown automation block kind: ${kind}`);
  return block;
}

export type DelayUnit = "seconds" | "minutes" | "hours";

export type AutomationNodeData = {
  kind: NodeKind;
  // message / media
  message?: string;
  caption?: string;
  mediaName?: string;
  service?: string;
  delayValue?: number;
  delayUnit?: DelayUnit;
  // crm actions
  staffId?: string;
  stage?: LeadStatus;
  followUpType?: FollowUpType;
  // filters
  keyword?: string;
  contains?: string;
  leadSource?: string;
  leadStage?: LeadStatus;
  assignedState?: "assigned" | "unassigned";
  location?: string;
  qualificationAnswer?: string;
  // flow
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  crossSellTargetService?: string;
  crossSellCondition?: string;
  responseLabel?: string;
  [key: string]: unknown;
};

export type AutomationNode = Node<AutomationNodeData, "automationNode">;
export type AutomationEdge = Edge;

export type Automation = {
  id: string;
  name: string;
  service: string;
  status: AutomationStatus;
  priority: number;
  updatedAt: string;
  nodes: AutomationNode[];
  edges: AutomationEdge[];
};

export function defaultDataForKind(kind: NodeKind, service: string): AutomationNodeData {
  const base: AutomationNodeData = { kind };
  if (MESSAGE_KINDS.includes(kind)) {
    base.service = service;
    base.delayValue = 10;
    base.delayUnit = "seconds";
  }
  if (kind === "flow_delay") {
    base.delayValue = 10;
    base.delayUnit = "seconds";
  }
  if (kind === "flow_crosssell") {
    base.crossSellCondition = "Only when qualified";
  }
  return base;
}
