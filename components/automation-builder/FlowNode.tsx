"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  BUILDER_CATEGORY_LABELS,
  BUILDER_NODE_DEFINITIONS,
  getPorts,
  isTriggerType,
  type BuilderCategory,
  type BuilderNodeData,
  type BuilderNodeType,
} from "@/lib/automations/builder-graph";
import { CAPTURABLE_LEAD_FIELDS } from "@/lib/automations/graph-schema";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import { BuilderIcon } from "@/components/automation-builder/BuilderIcon";
import type { FlowNodeType } from "@/components/automation-builder/flow-model";

// Category colour comes from existing design tokens only. Icons and the
// category label carry the meaning too, so colour is never the only signal.
const CATEGORY_TONE: Record<BuilderCategory, { icon: string; accent: string }> = {
  trigger: { icon: "bg-primary/15 text-primary", accent: "border-l-primary" },
  message: { icon: "bg-success-soft text-success", accent: "border-l-success" },
  action: { icon: "bg-gold/15 text-gold", accent: "border-l-gold" },
  logic: { icon: "bg-secondary text-foreground", accent: "border-l-muted-foreground" },
};

export function summarizeNode(type: BuilderNodeType, data: BuilderNodeData): string {
  const hasText = (value: string | undefined) => !!value && value.trim().length > 0;
  switch (type) {
    case "trigger": {
      const keywords = (data.keywords ?? []).filter((k) => k.trim().length > 0);
      return keywords.length > 0 ? `Keywords: ${keywords.join(", ")}` : "No keywords yet";
    }
    case "send_text":
    case "ask_question":
    case "buttons":
    case "list_message":
    case "notify_team":
      return hasText(data.text) ? `"${data.text}"` : "No message yet";
    case "send_image":
    case "send_video":
    case "send_audio":
    case "send_document":
      return hasText(data.mediaName) ? data.mediaName! : "No media chosen";
    case "send_template":
      return hasText(data.templateName) ? `Template: ${data.templateName}` : "No template chosen";
    case "save_to_crm": {
      const field = CAPTURABLE_LEAD_FIELDS.find((f) => f.value === data.fieldKey)?.label;
      return field ? `Save to ${field}` : "No CRM field chosen";
    }
    case "update_stage":
      return data.stage ? `Move to ${LEAD_STATUS_LABELS[data.stage]}` : "No stage chosen";
    case "assign_staff":
      return data.staffId ? "Assigned to a staff member" : "No staff chosen";
    case "add_tag":
      return hasText(data.tag) ? `Tag: ${data.tag}` : "No tag yet";
    case "create_follow_up":
      return hasText(data.followUpTitle) ? data.followUpTitle! : "No follow-up title yet";
    case "condition": {
      const field = data.conditionField === "customer_reply"
        ? "Customer reply"
        : CAPTURABLE_LEAD_FIELDS.find((f) => f.value === data.conditionField)?.label ?? "No field";
      return `${field} ${data.conditionOperator ?? ""}`.trim();
    }
    case "branch":
      return `${data.branchPaths?.length ?? 0} paths`;
    case "delay":
      return data.delayAmount ? `Wait ${data.delayAmount} ${data.delayUnit ?? "minutes"}` : "No wait time set";
    case "jump_to":
      return data.jumpTargetId ? "Jumps to another step" : "No target step chosen";
    default:
      return BUILDER_NODE_DEFINITIONS[type].description;
  }
}

export function FlowNode({ data, selected }: NodeProps<FlowNodeType>) {
  const type = data.nodeType;
  const def = BUILDER_NODE_DEFINITIONS[type];
  const tone = CATEGORY_TONE[def.category];
  const ports = getPorts(type, data);
  const name = data.label?.trim() || def.label;

  return (
    <div
      className={`w-60 rounded-xl border border-border border-l-4 bg-card text-left shadow-sm transition-shadow ${tone.accent} ${
        selected ? "shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      } ${data.hasIssue ? "border-danger/60" : ""}`}
    >
      {!isTriggerType(type) && (
        <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-card !bg-muted-foreground" />
      )}

      <div className="flex items-start gap-2.5 px-3 pb-2 pt-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
          <BuilderIcon type={type} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {BUILDER_CATEGORY_LABELS[def.category]}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        </div>
        {data.hasIssue && (
          <span
            role="img"
            aria-label="Needs attention"
            title="Needs attention before publishing"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-danger-foreground"
          >
            !
          </span>
        )}
      </div>

      <p className="line-clamp-2 px-3 pb-2.5 text-xs text-muted-foreground">{summarizeNode(type, data)}</p>

      {ports.length > 0 && (
        <div className="border-t border-border/70 py-1">
          {ports.map((port) => (
            <div key={port.id} className="relative flex items-center justify-end px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <span className="truncate pl-2">{port.label}</span>
              <Handle
                type="source"
                id={port.id}
                position={Position.Right}
                className="!h-3 !w-3 !border-2 !border-card !bg-primary"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
