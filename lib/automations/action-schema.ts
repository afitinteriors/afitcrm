// The versioned, validated shape of automations.actions (jsonb). Only one
// action type exists today -- create_or_link_lead -- because it's the only
// one with real, executable backing in this codebase (see
// lib/automations/crm-actions.ts). Every other action discussed in the
// design phase (assign_lead, set_stage, create_follow_up,
// send_whatsapp_text) is deliberately NOT defined here yet: adding a type
// here without a real handler would let an admin configure something that
// silently does nothing, which is worse than not offering it at all.
//
// `version` lets a future, incompatible shape be introduced without
// corrupting how existing rows are read -- parseAutomationActions() returns
// null (treated as "no executable actions", never as an error) for any
// unrecognized version or malformed value, so a bad row can never crash
// execution.

export type AutomationActionType = "create_or_link_lead";

export const AUTOMATION_ACTION_TYPES: AutomationActionType[] = ["create_or_link_lead"];

export type AutomationStep = {
  type: AutomationActionType;
  params: Record<string, never>;
};

export type AutomationActionsV1 = {
  version: 1;
  steps: AutomationStep[];
};

function isAutomationActionType(value: unknown): value is AutomationActionType {
  return typeof value === "string" && (AUTOMATION_ACTION_TYPES as string[]).includes(value);
}

export function parseAutomationActions(raw: unknown): AutomationActionsV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  if (!Array.isArray(obj.steps)) return null;

  const steps: AutomationStep[] = [];
  for (const step of obj.steps) {
    if (!step || typeof step !== "object") continue;
    const s = step as Record<string, unknown>;
    if (!isAutomationActionType(s.type)) continue;
    steps.push({ type: s.type, params: {} });
  }

  return { version: 1, steps };
}

export function buildActionsForCreateOrLinkLead(enabled: boolean): AutomationActionsV1 {
  return { version: 1, steps: enabled ? [{ type: "create_or_link_lead", params: {} }] : [] };
}
