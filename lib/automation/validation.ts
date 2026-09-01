import { MEDIA_MESSAGE_KINDS, getBlockDefinition, type Automation, type AutomationNode } from "@/lib/automation/types";

export type ValidationError = { nodeId?: string; message: string };

function nodeRequiredFieldErrors(node: AutomationNode): string[] {
  const { kind } = node.data;
  const label = getBlockDefinition(kind).label;
  const errors: string[] = [];

  if (kind === "message_text" && !node.data.message?.trim()) {
    errors.push(`"${label}" block needs a message.`);
  }
  if (MEDIA_MESSAGE_KINDS.includes(kind) && !node.data.mediaName?.trim()) {
    errors.push(`"${label}" block needs media selected.`);
  }
  if (kind.startsWith("message_") && !node.data.service) {
    errors.push(`"${label}" block needs a service selected.`);
  }
  if (kind === "action_assign_staff" && !node.data.staffId) {
    errors.push(`"Assign to Staff" block needs a staff member selected.`);
  }
  if (kind === "action_set_stage" && !node.data.stage) {
    errors.push(`"Set Live Stage" block needs a stage selected.`);
  }
  if (kind === "flow_condition" && !node.data.conditionValue?.trim()) {
    errors.push(`"Condition" block needs a value.`);
  }
  if (kind === "flow_crosssell" && !node.data.crossSellTargetService) {
    errors.push(`"Cross-sell Service" block needs a target service selected.`);
  }
  if (kind === "filter_keyword_match" && !node.data.keyword?.trim()) {
    errors.push(`"Keyword Match" block needs a keyword.`);
  }
  if (kind === "filter_message_contains" && !node.data.contains?.trim()) {
    errors.push(`"Message Contains" block needs a phrase.`);
  }

  return errors;
}

export function validateAutomation(automation: Automation): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!automation.name.trim()) {
    errors.push({ message: "Automation name is required." });
  }
  if (!automation.service) {
    errors.push({ message: "Automation must be assigned a primary service." });
  }

  const triggers = automation.nodes.filter((n) => n.data.kind.startsWith("trigger_"));
  if (triggers.length === 0) {
    errors.push({ message: "Add a trigger to start the journey." });
  } else if (triggers.length > 1) {
    errors.push({ message: "Only one trigger is allowed per journey." });
  }

  for (const node of automation.nodes) {
    for (const message of nodeRequiredFieldErrors(node)) {
      errors.push({ nodeId: node.id, message });
    }
  }

  if (automation.nodes.length > 1) {
    const connectedIds = new Set<string>();
    for (const edge of automation.edges) {
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    }
    for (const node of automation.nodes) {
      if (!connectedIds.has(node.id)) {
        const label = getBlockDefinition(node.data.kind).label;
        errors.push({ nodeId: node.id, message: `"${label}" block isn't connected to the journey.` });
      }
    }
  }

  return errors;
}
