"use client";

import {
  AUTOMATION_SERVICES,
  MEDIA_MESSAGE_KINDS,
  getBlockDefinition,
  type AutomationNode,
  type AutomationNodeData,
  type DelayUnit,
} from "@/lib/automation/types";
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";
import type { StaffOption } from "@/lib/staff";

const LABEL_CLASS = "block text-xs font-medium text-slate-500";
const INPUT_CLASS =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";

const MEDIA_LABEL: Record<string, string> = {
  message_image: "Image",
  message_video: "Video",
  message_file: "File",
};

function DelayField({
  value,
  unit,
  onChange,
}: {
  value: number | undefined;
  unit: DelayUnit | undefined;
  onChange: (value: number, unit: DelayUnit) => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label className={LABEL_CLASS}>Delay</label>
        <input
          type="number"
          min={0}
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value), unit ?? "seconds")}
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex-1">
        <label className={LABEL_CLASS}>&nbsp;</label>
        <select
          value={unit ?? "seconds"}
          onChange={(e) => onChange(value ?? 0, e.target.value as DelayUnit)}
          className={INPUT_CLASS}
        >
          <option value="seconds">seconds</option>
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
        </select>
      </div>
    </div>
  );
}

function ServiceField({ value, onChange }: { value: string | undefined; onChange: (value: string) => void }) {
  return (
    <div>
      <label className={LABEL_CLASS}>Service</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
        <option value="" disabled>
          Select a service…
        </option>
        {AUTOMATION_SERVICES.map((service) => (
          <option key={service} value={service}>
            {service}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ConfigPanel({
  node,
  staff,
  onChange,
}: {
  node: AutomationNode | null;
  staff: StaffOption[];
  onChange: (data: Partial<AutomationNodeData>) => void;
}) {
  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-slate-400">Select a block to configure it.</p>
        </div>
      </aside>
    );
  }

  const block = getBlockDefinition(node.data.kind);
  const isMedia = MEDIA_MESSAGE_KINDS.includes(node.data.kind);
  const d = node.data;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-medium text-slate-400">{block.category.toUpperCase()}</p>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <span>{block.icon}</span> {block.label}
        </p>
      </div>

      <div className="space-y-4 p-4">
        {node.data.kind === "message_text" && (
          <>
            <div>
              <label className={LABEL_CLASS}>Message</label>
              <textarea
                value={d.message ?? ""}
                onChange={(e) => onChange({ message: e.target.value })}
                rows={4}
                placeholder="Welcome to our Gypsum Plastering service..."
                className={INPUT_CLASS}
              />
            </div>
            <ServiceField value={d.service} onChange={(service) => onChange({ service })} />
            <DelayField value={d.delayValue} unit={d.delayUnit} onChange={(delayValue, delayUnit) => onChange({ delayValue, delayUnit })} />
          </>
        )}

        {isMedia && (
          <>
            <div>
              <label className={LABEL_CLASS}>{MEDIA_LABEL[node.data.kind]}</label>
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt(
                    `Enter a placeholder ${MEDIA_LABEL[node.data.kind].toLowerCase()} filename (UI prototype only, no real upload):`,
                    d.mediaName ?? ""
                  );
                  if (name !== null) onChange({ mediaName: name });
                }}
                className="mt-1 block w-full rounded-md border border-dashed border-slate-300 px-3 py-2 text-left text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              >
                {d.mediaName || `Select ${MEDIA_LABEL[node.data.kind].toLowerCase()}…`}
              </button>
            </div>
            <div>
              <label className={LABEL_CLASS}>Caption</label>
              <textarea
                value={d.caption ?? ""}
                onChange={(e) => onChange({ caption: e.target.value })}
                rows={3}
                className={INPUT_CLASS}
              />
            </div>
            <ServiceField value={d.service} onChange={(service) => onChange({ service })} />
            <DelayField value={d.delayValue} unit={d.delayUnit} onChange={(delayValue, delayUnit) => onChange({ delayValue, delayUnit })} />
          </>
        )}

        {(node.data.kind === "message_template" || node.data.kind === "message_interactive" || node.data.kind === "message_cta") && (
          <>
            <div>
              <label className={LABEL_CLASS}>
                {node.data.kind === "message_template" ? "Template name" : node.data.kind === "message_cta" ? "Button label" : "Options (one per line)"}
              </label>
              <textarea
                value={d.message ?? ""}
                onChange={(e) => onChange({ message: e.target.value })}
                rows={3}
                className={INPUT_CLASS}
              />
            </div>
            <ServiceField value={d.service} onChange={(service) => onChange({ service })} />
            <DelayField value={d.delayValue} unit={d.delayUnit} onChange={(delayValue, delayUnit) => onChange({ delayValue, delayUnit })} />
          </>
        )}

        {node.data.kind === "flow_delay" && (
          <DelayField value={d.delayValue} unit={d.delayUnit} onChange={(delayValue, delayUnit) => onChange({ delayValue, delayUnit })} />
        )}

        {node.data.kind === "action_assign_staff" && (
          <div>
            <label className={LABEL_CLASS}>Staff member</label>
            <select value={d.staffId ?? ""} onChange={(e) => onChange({ staffId: e.target.value })} className={INPUT_CLASS}>
              <option value="" disabled>
                Select a staff member…
              </option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name || "Unnamed staff"}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.kind === "action_set_stage" && (
          <div>
            <label className={LABEL_CLASS}>Live Stage</label>
            <select
              value={d.stage ?? ""}
              onChange={(e) => onChange({ stage: e.target.value as AutomationNodeData["stage"] })}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Select a stage…
              </option>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.kind === "action_add_service" && <ServiceField value={d.service} onChange={(service) => onChange({ service })} />}

        {node.data.kind === "action_start_followup" && (
          <div>
            <label className={LABEL_CLASS}>Follow-up type</label>
            <select
              value={d.followUpType ?? ""}
              onChange={(e) => onChange({ followUpType: e.target.value as AutomationNodeData["followUpType"] })}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Select a type…
              </option>
              <option value="call">Call</option>
              <option value="whatsapp_message">WhatsApp message</option>
              <option value="site_visit">Site visit</option>
              <option value="quotation">Quotation</option>
              <option value="meeting">Meeting</option>
              <option value="follow_up">Follow-up</option>
            </select>
          </div>
        )}

        {node.data.kind === "filter_detect_service" && <ServiceField value={d.service} onChange={(service) => onChange({ service })} />}

        {node.data.kind === "filter_keyword_match" && (
          <div>
            <label className={LABEL_CLASS}>Keyword</label>
            <input value={d.keyword ?? ""} onChange={(e) => onChange({ keyword: e.target.value })} placeholder="gypsum" className={INPUT_CLASS} />
          </div>
        )}

        {node.data.kind === "filter_message_contains" && (
          <div>
            <label className={LABEL_CLASS}>Phrase</label>
            <input value={d.contains ?? ""} onChange={(e) => onChange({ contains: e.target.value })} className={INPUT_CLASS} />
          </div>
        )}

        {node.data.kind === "filter_lead_source" && (
          <div>
            <label className={LABEL_CLASS}>Lead source</label>
            <select value={d.leadSource ?? ""} onChange={(e) => onChange({ leadSource: e.target.value })} className={INPUT_CLASS}>
              <option value="" disabled>
                Select a source…
              </option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.kind === "filter_lead_stage" && (
          <div>
            <label className={LABEL_CLASS}>Lead stage</label>
            <select
              value={d.leadStage ?? ""}
              onChange={(e) => onChange({ leadStage: e.target.value as AutomationNodeData["leadStage"] })}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Select a stage…
              </option>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        )}

        {node.data.kind === "filter_assigned_state" && (
          <div>
            <label className={LABEL_CLASS}>Assigned state</label>
            <select
              value={d.assignedState ?? ""}
              onChange={(e) => onChange({ assignedState: e.target.value as AutomationNodeData["assignedState"] })}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        )}

        {node.data.kind === "filter_location" && (
          <div>
            <label className={LABEL_CLASS}>Location</label>
            <input value={d.location ?? ""} onChange={(e) => onChange({ location: e.target.value })} className={INPUT_CLASS} />
          </div>
        )}

        {node.data.kind === "filter_qualification_answer" && (
          <div>
            <label className={LABEL_CLASS}>Expected answer</label>
            <input
              value={d.qualificationAnswer ?? ""}
              onChange={(e) => onChange({ qualificationAnswer: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        )}

        {node.data.kind === "flow_condition" && (
          <>
            <div>
              <label className={LABEL_CLASS}>Field</label>
              <input
                value={d.conditionField ?? ""}
                onChange={(e) => onChange({ conditionField: e.target.value })}
                placeholder="e.g. Customer answer"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Operator</label>
              <input
                value={d.conditionOperator ?? ""}
                onChange={(e) => onChange({ conditionOperator: e.target.value })}
                placeholder="e.g. contains"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Value</label>
              <input value={d.conditionValue ?? ""} onChange={(e) => onChange({ conditionValue: e.target.value })} className={INPUT_CLASS} />
            </div>
          </>
        )}

        {node.data.kind === "flow_customer_response" && (
          <div>
            <label className={LABEL_CLASS}>Expected response label</label>
            <input
              value={d.responseLabel ?? ""}
              onChange={(e) => onChange({ responseLabel: e.target.value })}
              placeholder="e.g. Interested"
              className={INPUT_CLASS}
            />
          </div>
        )}

        {node.data.kind === "flow_crosssell" && (
          <>
            <div className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700">
              This block intentionally introduces another service. It never runs inside the initial service journey
              unless you add it here.
            </div>
            <div>
              <label className={LABEL_CLASS}>Target service</label>
              <select
                value={d.crossSellTargetService ?? ""}
                onChange={(e) => onChange({ crossSellTargetService: e.target.value })}
                className={INPUT_CLASS}
              >
                <option value="" disabled>
                  Select a service…
                </option>
                {AUTOMATION_SERVICES.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Condition</label>
              <input
                value={d.crossSellCondition ?? ""}
                onChange={(e) => onChange({ crossSellCondition: e.target.value })}
                placeholder="Only when qualified / configured"
                className={INPUT_CLASS}
              />
            </div>
          </>
        )}

        {(node.data.kind === "trigger_new_message" ||
          node.data.kind === "trigger_customer_reply" ||
          node.data.kind === "trigger_lead_created" ||
          node.data.kind === "trigger_stage_changed" ||
          node.data.kind === "trigger_followup_due" ||
          node.data.kind === "action_create_link_lead" ||
          node.data.kind === "action_assign_admin" ||
          node.data.kind === "action_stop_automation" ||
          node.data.kind === "flow_stop") && (
          <p className="text-xs text-slate-400">This block doesn&apos;t need additional configuration.</p>
        )}
      </div>
    </aside>
  );
}
