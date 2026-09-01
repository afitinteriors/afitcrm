"use client";

import { createContext, useContext } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getBlockDefinition, type AutomationNode } from "@/lib/automation/types";
import { LEAD_STATUS_LABELS } from "@/lib/constants";
import type { StaffOption } from "@/lib/staff";

export type CanvasActions = {
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  staffById: Record<string, string>;
};

export const CanvasActionsContext = createContext<CanvasActions>({
  onDelete: () => {},
  onDuplicate: () => {},
  staffById: {},
});

const CATEGORY_BORDER: Record<string, string> = {
  trigger: "border-emerald-300",
  filter: "border-sky-300",
  action: "border-indigo-300",
  message: "border-blue-300",
  flow: "border-amber-300",
};

const NO_SOURCE = ["flow_stop", "action_stop_automation"];
const BRANCHING = ["flow_condition", "flow_customer_response"];

function summaryLine(node: AutomationNode, staffById: Record<string, string>): string {
  const d = node.data;
  switch (d.kind) {
    case "action_assign_staff":
      return d.staffId ? `Assign to ${staffById[d.staffId] ?? "staff"}` : "No staff selected";
    case "action_assign_admin":
      return "Assign to admin";
    case "action_set_stage":
      return d.stage ? `Set stage to ${LEAD_STATUS_LABELS[d.stage]}` : "No stage selected";
    case "action_add_service":
      return d.service ? `Add ${d.service}` : "No service selected";
    case "action_start_followup":
      return d.followUpType ? `Follow-up: ${d.followUpType}` : "Follow-up type not set";
    case "action_create_link_lead":
      return "Create the lead, or link this conversation to one";
    case "action_stop_automation":
      return "Ends this automation";
    case "filter_detect_service":
      return d.service ? `Looking for: ${d.service}` : "No service configured";
    case "filter_keyword_match":
      return d.keyword ? `Keyword: "${d.keyword}"` : "No keyword set";
    case "filter_message_contains":
      return d.contains ? `Contains: "${d.contains}"` : "No phrase set";
    case "filter_lead_source":
      return d.leadSource ? `Source: ${d.leadSource}` : "No source set";
    case "filter_lead_stage":
      return d.leadStage ? `Stage: ${LEAD_STATUS_LABELS[d.leadStage]}` : "No stage set";
    case "filter_assigned_state":
      return d.assignedState ? `State: ${d.assignedState}` : "No state set";
    case "filter_location":
      return d.location ? `Location: ${d.location}` : "No location set";
    case "filter_qualification_answer":
      return d.qualificationAnswer ? `Answer: ${d.qualificationAnswer}` : "No answer set";
    case "flow_condition":
      return d.conditionValue ? `${d.conditionField ?? "Field"} ${d.conditionOperator ?? "="} "${d.conditionValue}"` : "No condition set";
    case "flow_customer_response":
      return d.responseLabel ? `Waiting for: ${d.responseLabel}` : "No expected response set";
    case "flow_stop":
      return "Ends this branch";
    case "message_template":
      return d.message ? `Template: ${d.message}` : "No template selected";
    case "message_interactive":
      return d.message || "No options configured";
    case "message_cta":
      return d.message || "No button configured";
    default:
      return "";
  }
}

export function AutomationNodeCard({ id, data, selected }: NodeProps<AutomationNode>) {
  const { onDelete, onDuplicate, staffById } = useContext(CanvasActionsContext);
  const block = getBlockDefinition(data.kind);
  const isTrigger = data.kind.startsWith("trigger_");
  const isMessage = data.kind.startsWith("message_");
  const isCrossSell = data.kind === "flow_crosssell";
  const isMedia = data.kind === "message_image" || data.kind === "message_video" || data.kind === "message_file";
  const hasTarget = !isTrigger;
  const hasSource = !NO_SOURCE.includes(data.kind);
  const isBranching = BRANCHING.includes(data.kind);

  return (
    <div
      className={`w-64 rounded-lg border-2 bg-white shadow-sm ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : CATEGORY_BORDER[block.category] ?? "border-slate-300"
      }`}
    >
      {hasTarget && <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-400" />}

      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-base leading-none">{block.icon}</span>
          <span className="truncate text-sm font-semibold text-slate-900">{block.label}</span>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(id);
            }}
            aria-label="Duplicate block"
            title="Duplicate"
            className="rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ⧉
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            aria-label="Delete block"
            title="Delete"
            className="rounded px-1 text-xs text-slate-400 hover:bg-red-100 hover:text-red-700"
          >
            ×
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        {isCrossSell ? (
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700 ring-1 ring-inset ring-purple-300">
              Cross-sell
            </span>
            <p className="text-xs text-slate-600">
              Target:{" "}
              <span className="font-medium text-slate-900">{data.crossSellTargetService || "Not selected"}</span>
            </p>
            {data.crossSellCondition && <p className="text-[11px] text-slate-400">{data.crossSellCondition}</p>}
          </div>
        ) : isMessage ? (
          <div className="space-y-1.5">
            {data.service && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-200">
                {data.service}
              </span>
            )}
            {typeof data.delayValue === "number" && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Delay</span>
                <span className="font-medium text-slate-700">
                  {data.delayValue} {data.delayUnit ?? "seconds"}
                </span>
              </div>
            )}
            {isMedia ? (
              <p className={`truncate text-xs ${data.mediaName ? "text-slate-700" : "italic text-red-500"}`}>
                {data.mediaName || "No media selected"}
              </p>
            ) : data.kind === "message_text" ? (
              <p className={`line-clamp-2 text-xs ${data.message ? "text-slate-700" : "italic text-red-500"}`}>
                {data.message ? `"${data.message}"` : "No message yet"}
              </p>
            ) : (
              <p className="text-xs text-slate-500">{summaryLine({ id, data } as AutomationNode, staffById)}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {block.description}
            {summaryLine({ id, data } as AutomationNode, staffById) && (
              <span className="mt-1 block font-medium text-slate-700">
                {summaryLine({ id, data } as AutomationNode, staffById)}
              </span>
            )}
          </p>
        )}
      </div>

      {hasSource && !isBranching && (
        <div className="border-t border-slate-100 px-3 py-1.5">
          <span className="text-[11px] text-slate-400">{isMessage ? "Message" : "Next"}</span>
          <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-400" />
        </div>
      )}

      {isBranching && (
        <div className="flex justify-between border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500">
          <span>Yes / Interested</span>
          <span>No / Timeout</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ left: "25%" }}
            className="!h-3 !w-3 !bg-emerald-500"
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ left: "75%" }}
            className="!h-3 !w-3 !bg-slate-400"
          />
        </div>
      )}
    </div>
  );
}

export function useStaffLookup(staff: StaffOption[]): Record<string, string> {
  return Object.fromEntries(staff.map((s) => [s.id, s.display_name || "Unnamed staff"]));
}
