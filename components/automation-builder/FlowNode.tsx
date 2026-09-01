"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { getNodeDefinition, CAPTURABLE_LEAD_FIELDS, type AutomationNodeType, type CapturableLeadField } from "@/lib/automations/graph-schema";

export type FlowNodeData = {
  nodeType: AutomationNodeType;
  fieldKey?: CapturableLeadField;
  text?: string;
  mediaAssetId?: string;
  mediaAssetName?: string;
};
export type FlowNodeType = Node<FlowNodeData, "flowNode">;

const NODE_ACCENT: Record<AutomationNodeType, string> = {
  trigger: "border-primary/40 bg-primary/5",
  create_or_link_lead: "border-success/40 bg-success-soft",
  end: "border-border bg-secondary",
  send_text: "",
  send_image: "",
  send_video: "",
  ask_question: "",
  capture_lead_field: "",
  condition: "",
};

export function FlowNode({ data, selected }: NodeProps<FlowNodeType>) {
  const def = getNodeDefinition(data.nodeType);
  const accent = NODE_ACCENT[data.nodeType] || "border-border bg-card";
  const fieldLabel =
    data.nodeType === "capture_lead_field" && data.fieldKey
      ? CAPTURABLE_LEAD_FIELDS.find((f) => f.value === data.fieldKey)?.label
      : null;
  const textPreview =
    (data.nodeType === "send_text" || data.nodeType === "ask_question") && data.text ? data.text : null;
  const mediaPreview =
    (data.nodeType === "send_image" || data.nodeType === "send_video") && data.mediaAssetId
      ? data.mediaAssetName ?? "Media selected"
      : null;

  return (
    <div
      className={`w-52 rounded-lg border-2 px-3 py-2.5 shadow-sm ${accent} ${
        selected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      {data.nodeType !== "trigger" && <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />}
      <p className="text-sm font-semibold text-foreground">{def.label}</p>
      {fieldLabel ? (
        <p className="mt-0.5 text-xs font-medium text-primary">Field: {fieldLabel}</p>
      ) : textPreview ? (
        <p className="mt-0.5 line-clamp-2 text-xs font-medium text-primary">&ldquo;{textPreview}&rdquo;</p>
      ) : mediaPreview ? (
        <p className="mt-0.5 line-clamp-2 text-xs font-medium text-primary">🖼 {mediaPreview}</p>
      ) : (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{def.description}</p>
      )}
      {data.nodeType !== "end" && <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />}
    </div>
  );
}
