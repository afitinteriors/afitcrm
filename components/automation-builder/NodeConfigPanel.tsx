"use client";

import type { ReactNode } from "react";
import type { Edge } from "@xyflow/react";
import {
  BUILDER_CATEGORY_LABELS,
  BUILDER_NODE_DEFINITIONS,
  NEXT_PORT,
  getPorts,
  type AnswerType,
  type BuilderNodeData,
  type ConditionOperator,
  type DelayUnit,
  type FlowIssue,
  type MatchType,
  type ValueSource,
} from "@/lib/automations/builder-graph";
import { CAPTURABLE_LEAD_FIELDS } from "@/lib/automations/graph-schema";
import { LEAD_STATUS_LABELS, PIPELINE_STATUSES } from "@/lib/constants";
import type { StaffOption } from "@/lib/staff";
import type { AutomationMediaRow } from "@/lib/supabase/types";
import { BuilderIcon } from "@/components/automation-builder/BuilderIcon";
import type { FlowNodeType } from "@/components/automation-builder/flow-model";
import {
  MediaPicker,
  PlaceholderPicker,
  PLACEHOLDER_AUDIO,
  PLACEHOLDER_DOCUMENTS,
  PLACEHOLDER_TEMPLATES,
} from "@/components/automation-builder/MediaPicker";

const INPUT =
  "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const SMALL_BUTTON =
  "h-8 rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

export type NodePatch = (id: string, patch: Partial<BuilderNodeData>, coalesceKey?: string) => void;

export type NodeConfigProps = {
  node: FlowNodeType | null;
  nodes: FlowNodeType[];
  edges: Edge[];
  issues: FlowIssue[];
  staff: StaffOption[];
  mediaAssets: AutomationMediaRow[];
  onPatch: NodePatch;
  onMediaUploaded: (asset: AutomationMediaRow) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
};

export function NodeConfigPanel(props: NodeConfigProps) {
  if (!props.node) {
    return (
      <aside aria-label="Block settings" className="flex w-72 shrink-0 flex-col border-l border-border bg-card xl:w-80">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-sm font-medium text-foreground">No block selected</p>
          <p className="text-xs text-muted-foreground">
            Select a block on the canvas to edit its settings, see where each output goes, or duplicate or delete it.
          </p>
        </div>
      </aside>
    );
  }
  return <ConfigBody key={props.node.id} {...props} node={props.node} />;
}

function ConfigBody({
  node,
  nodes,
  edges,
  issues,
  staff,
  mediaAssets,
  onPatch,
  onMediaUploaded,
  onDelete,
  onDuplicate,
}: NodeConfigProps & { node: FlowNodeType }) {
  const type = node.data.nodeType;
  const def = BUILDER_NODE_DEFINITIONS[type];
  const data = node.data;
  const patch = (p: Partial<BuilderNodeData>, key?: string) =>
    onPatch(node.id, p, key ?? `cfg:${node.id}:${Object.keys(p).join(",")}`);
  const nodeIssues = issues.filter((i) => i.nodeId === node.id);
  const ports = getPorts(type, data);

  return (
    <aside aria-label="Block settings" className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card xl:w-80">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <BuilderIcon type={type} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {BUILDER_CATEGORY_LABELS[def.category]}
          </p>
          <p className="truncate text-sm font-semibold text-foreground">{def.label}</p>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {nodeIssues.length > 0 && (
          <div role="alert" className="space-y-1 rounded-md border border-danger/30 bg-danger-soft p-3">
            <p className="text-xs font-semibold text-danger">Needs attention</p>
            {nodeIssues.map((issue, i) => (
              <p key={i} className="text-xs text-danger">
                {issue.message}
              </p>
            ))}
          </div>
        )}

        <Field label="Block name" hint="Shown on the canvas. Optional.">
          <input
            type="text"
            value={data.label ?? ""}
            maxLength={80}
            placeholder={def.label}
            onChange={(e) => patch({ label: e.target.value })}
            className={INPUT}
          />
        </Field>

        <TypeSettings
          node={node}
          data={data}
          nodes={nodes}
          staff={staff}
          mediaAssets={mediaAssets}
          patch={patch}
          onMediaUploaded={onMediaUploaded}
        />

        {ports.length > 0 && (
          <section aria-label="Outputs">
            <p className="text-xs font-semibold text-foreground">Where each output goes</p>
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {ports.map((port) => {
                const edge = edges.find((e) => e.source === node.id && (e.sourceHandle ?? NEXT_PORT) === port.id);
                const target = edge ? nodes.find((n) => n.id === edge.target) : undefined;
                return (
                  <li key={port.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="font-medium text-foreground">{port.label}</span>
                    {target ? (
                      <span className="truncate text-muted-foreground">
                        → {target.data.label?.trim() || BUILDER_NODE_DEFINITIONS[target.data.nodeType].label}
                      </span>
                    ) : (
                      <span className="shrink-0 text-warning">Not connected</span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Drag from an output dot on the canvas to connect it.</p>
          </section>
        )}

        <div className="flex gap-2 border-t border-border pt-4">
          <button type="button" onClick={() => onDuplicate(node.id)} className={`${SMALL_BUTTON} flex-1`}>
            Duplicate
          </button>
          {type !== "trigger" && (
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              className="h-8 flex-1 rounded-md border border-danger/30 px-2.5 text-xs font-medium text-danger hover:bg-danger-soft"
            >
              Delete
            </button>
          )}
        </div>
        {type === "trigger" && (
          <p className="text-[11px] text-muted-foreground">The keyword trigger is the start of this service&apos;s flow and can&apos;t be deleted.</p>
        )}
      </div>
    </aside>
  );
}

function TypeSettings({
  node,
  data,
  nodes,
  staff,
  mediaAssets,
  patch,
  onMediaUploaded,
}: {
  node: FlowNodeType;
  data: BuilderNodeData & { nodeType: string };
  nodes: FlowNodeType[];
  staff: StaffOption[];
  mediaAssets: AutomationMediaRow[];
  patch: (p: Partial<BuilderNodeData>, key?: string) => void;
  onMediaUploaded: (asset: AutomationMediaRow) => void;
}) {
  const type = node.data.nodeType;
  const messageField = (label: string, placeholder: string) => (
    <Field label={label}>
      <textarea
        value={data.text ?? ""}
        onChange={(e) => patch({ text: e.target.value }, `text:${node.id}`)}
        rows={4}
        maxLength={4000}
        placeholder={placeholder}
        className={INPUT}
      />
    </Field>
  );

  switch (type) {
    case "trigger":
      return <KeywordSettings data={data} patch={patch} />;

    case "new_message":
    case "meta_lead":
    case "button_clicked":
    case "list_selection":
    case "conversation_start":
      return <Note>This trigger has no settings yet. It starts the flow; connect its output to the first step.</Note>;

    case "send_text":
      return messageField("Message", "e.g. Thanks for reaching out! Here's a bit about us…");

    case "notify_team":
      return messageField("Notification message", "e.g. New qualified lead: check the CRM.");

    case "send_image":
    case "send_video":
      return (
        <>
          <MediaPicker
            key={node.id}
            mediaType={type === "send_image" ? "image" : "video"}
            mediaAssets={mediaAssets}
            selectedId={data.mediaAssetId}
            onSelect={(id) => {
              const name = mediaAssets.find((a) => a.id === id)?.name;
              patch({ mediaAssetId: id, mediaName: name });
            }}
            onUploaded={onMediaUploaded}
          />
          <Field label="Caption (optional)">
            <textarea
              value={data.caption ?? ""}
              onChange={(e) => patch({ caption: e.target.value }, `caption:${node.id}`)}
              rows={2}
              maxLength={1024}
              className={INPUT}
            />
          </Field>
        </>
      );

    case "send_audio":
      return (
        <PlaceholderPicker
          label="Audio / voice note"
          options={PLACEHOLDER_AUDIO}
          value={data.mediaName}
          onChange={(v) => patch({ mediaName: v })}
        />
      );

    case "send_document":
      return (
        <>
          <PlaceholderPicker
            label="Document"
            options={PLACEHOLDER_DOCUMENTS}
            value={data.mediaName}
            onChange={(v) => patch({ mediaName: v })}
          />
          <Field label="Caption (optional)">
            <input
              type="text"
              value={data.caption ?? ""}
              onChange={(e) => patch({ caption: e.target.value }, `caption:${node.id}`)}
              maxLength={1024}
              className={INPUT}
            />
          </Field>
        </>
      );

    case "send_template":
      return (
        <PlaceholderPicker
          label="Template"
          options={PLACEHOLDER_TEMPLATES}
          value={data.templateName}
          onChange={(v) => patch({ templateName: v })}
        />
      );

    case "ask_question":
      return (
        <>
          {messageField("Question", "e.g. Where is your project located?")}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Answer type">
              <select value={data.answerType ?? "text"} onChange={(e) => patch({ answerType: e.target.value as AnswerType })} className={INPUT}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="phone">Phone</option>
                <option value="choice">Choice</option>
              </select>
            </Field>
            <Field label="Retries">
              <select value={data.retryLimit ?? 0} onChange={(e) => patch({ retryLimit: Number(e.target.value) })} className={INPUT}>
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "None" : `Up to ${n}`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Toggle label="Required" checked={data.required ?? true} onChange={(v) => patch({ required: v })} />
          <Note>A valid answer follows “Valid answer”. After the retries run out, or on a non-matching answer, the flow follows “Fallback”.</Note>
        </>
      );

    case "buttons":
      return (
        <>
          {messageField("Message", "e.g. Would you like a site visit or a quotation?")}
          <ChoiceList
            label="Buttons (max 3)"
            items={data.buttons ?? []}
            max={3}
            addLabel="Add button"
            placeholder="Button label"
            onChange={(buttons) => patch({ buttons })}
          />
          <Note>Each button has its own output, shown below. Connect each one to its next step.</Note>
        </>
      );

    case "list_message":
      return (
        <>
          {messageField("Message", "e.g. Choose the service you need.")}
          <Field label="List button label">
            <input
              type="text"
              value={data.listTitle ?? ""}
              onChange={(e) => patch({ listTitle: e.target.value }, `listTitle:${node.id}`)}
              maxLength={20}
              placeholder="e.g. Choose"
              className={INPUT}
            />
          </Field>
          <ChoiceList
            label="Options (max 10)"
            items={data.items ?? []}
            max={10}
            addLabel="Add option"
            placeholder="Option label"
            onChange={(items) => patch({ items })}
          />
        </>
      );

    case "save_to_crm":
      return (
        <>
          <Field label="CRM field">
            <select value={data.fieldKey ?? ""} onChange={(e) => patch({ fieldKey: e.target.value as BuilderNodeData["fieldKey"] })} className={INPUT}>
              <option value="" disabled>
                Choose a field…
              </option>
              {CAPTURABLE_LEAD_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Value source">
            <select value={data.valueSource ?? "customer_reply"} onChange={(e) => patch({ valueSource: e.target.value as ValueSource })} className={INPUT}>
              <option value="customer_reply">Customer&apos;s reply</option>
              <option value="fixed">Fixed value</option>
            </select>
          </Field>
          {data.valueSource === "fixed" && (
            <Field label="Fixed value">
              <input
                type="text"
                value={data.fixedValue ?? ""}
                onChange={(e) => patch({ fixedValue: e.target.value }, `fixedValue:${node.id}`)}
                maxLength={500}
                className={INPUT}
              />
            </Field>
          )}
        </>
      );

    case "update_stage":
      return (
        <Field label="Pipeline stage">
          <select value={data.stage ?? ""} onChange={(e) => patch({ stage: e.target.value as BuilderNodeData["stage"] })} className={INPUT}>
            <option value="" disabled>
              Choose a stage…
            </option>
            {PIPELINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      );

    case "assign_staff":
      return (
        <Field label="Staff member">
          <select value={data.staffId ?? ""} onChange={(e) => patch({ staffId: e.target.value })} className={INPUT}>
            <option value="" disabled>
              Choose a staff member…
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name ?? "Unnamed staff"}
              </option>
            ))}
          </select>
        </Field>
      );

    case "add_tag":
      return (
        <Field label="Tag">
          <input
            type="text"
            value={data.tag ?? ""}
            onChange={(e) => patch({ tag: e.target.value }, `tag:${node.id}`)}
            maxLength={40}
            placeholder="e.g. interior-enquiry"
            className={INPUT}
          />
        </Field>
      );

    case "create_follow_up":
      return (
        <>
          <Field label="Follow-up title">
            <input
              type="text"
              value={data.followUpTitle ?? ""}
              onChange={(e) => patch({ followUpTitle: e.target.value }, `followUpTitle:${node.id}`)}
              maxLength={120}
              placeholder="e.g. Call back about site visit"
              className={INPUT}
            />
          </Field>
          <Field label="Due in (hours)">
            <input
              type="number"
              min={0}
              max={8760}
              value={data.followUpDueHours ?? ""}
              onChange={(e) => patch({ followUpDueHours: e.target.value === "" ? undefined : Number(e.target.value) })}
              className={INPUT}
            />
          </Field>
        </>
      );

    case "condition": {
      const operator = data.conditionOperator ?? "equals";
      const needsValue = operator !== "is_empty" && operator !== "is_not_empty";
      return (
        <>
          <Field label="Check">
            <select value={data.conditionField ?? ""} onChange={(e) => patch({ conditionField: e.target.value as BuilderNodeData["conditionField"] })} className={INPUT}>
              <option value="" disabled>
                Choose…
              </option>
              <option value="customer_reply">Customer reply</option>
              {CAPTURABLE_LEAD_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Operator">
            <select value={operator} onChange={(e) => patch({ conditionOperator: e.target.value as ConditionOperator })} className={INPUT}>
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="is_empty">Is empty</option>
              <option value="is_not_empty">Is not empty</option>
            </select>
          </Field>
          {needsValue && (
            <Field label="Value">
              <input
                type="text"
                value={data.conditionValue ?? ""}
                onChange={(e) => patch({ conditionValue: e.target.value }, `conditionValue:${node.id}`)}
                maxLength={200}
                className={INPUT}
              />
            </Field>
          )}
          <Note>Yes and No are both outputs. Connect each one.</Note>
        </>
      );
    }

    case "branch":
      return (
        <>
          <ChoiceList
            label="Paths (2 to 5)"
            items={data.branchPaths ?? []}
            max={5}
            addLabel="Add path"
            placeholder="Path label"
            onChange={(branchPaths) => patch({ branchPaths })}
          />
          <Note>Each path is its own output, shown below.</Note>
        </>
      );

    case "delay":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Wait for">
            <input
              type="number"
              min={1}
              max={10000}
              value={data.delayAmount ?? ""}
              onChange={(e) => patch({ delayAmount: e.target.value === "" ? undefined : Number(e.target.value) })}
              className={INPUT}
            />
          </Field>
          <Field label="Unit">
            <select value={data.delayUnit ?? "minutes"} onChange={(e) => patch({ delayUnit: e.target.value as DelayUnit })} className={INPUT}>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </Field>
        </div>
      );

    case "jump_to": {
      const targets = nodes.filter((n) => n.id !== node.id);
      return (
        <Field label="Continue at step">
          <select value={data.jumpTargetId ?? ""} onChange={(e) => patch({ jumpTargetId: e.target.value || undefined })} className={INPUT}>
            <option value="">Choose a step…</option>
            {targets.map((n) => (
              <option key={n.id} value={n.id}>
                {n.data.label?.trim() || BUILDER_NODE_DEFINITIONS[n.data.nodeType].label}
              </option>
            ))}
          </select>
        </Field>
      );
    }

    case "end_flow":
      return <Note>Ends this path. Nothing can be connected after it.</Note>;

    case "create_or_link_lead":
      return <Note>Creates a lead for this conversation, or links it to an existing one by phone number.</Note>;

    default:
      return null;
  }
}

function KeywordSettings({
  data,
  patch,
}: {
  data: BuilderNodeData;
  patch: (p: Partial<BuilderNodeData>, key?: string) => void;
}) {
  const keywords = data.keywords ?? [];
  const setKeywords = (next: string[]) => patch({ keywords: next }, "keywords");
  return (
    <>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Keywords</p>
        <ul className="mt-1 space-y-2">
          {keywords.map((kw, i) => (
            <li key={i} className="flex gap-2">
              <input
                type="text"
                value={kw}
                maxLength={60}
                aria-label={`Keyword ${i + 1}`}
                aria-invalid={kw.trim().length === 0}
                onChange={(e) => setKeywords(keywords.map((k, j) => (j === i ? e.target.value : k)))}
                className={`${INPUT} mt-0 ${kw.trim().length === 0 ? "border-danger" : ""}`}
              />
              <button
                type="button"
                aria-label={`Remove keyword ${i + 1}`}
                onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}
                className="h-9 shrink-0 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={keywords.length >= 20}
          onClick={() => setKeywords([...keywords, ""])}
          className={`${SMALL_BUTTON} mt-2 w-full`}
        >
          Add keyword
        </button>
      </div>
      <Field label="Match type">
        <select value={data.matchType ?? "contains"} onChange={(e) => patch({ matchType: e.target.value as MatchType })} className={INPUT}>
          <option value="contains">Contains</option>
          <option value="exact">Exact</option>
          <option value="starts_with">Starts with</option>
        </select>
      </Field>
      <Toggle label="Case sensitive" checked={data.caseSensitive ?? false} onChange={(v) => patch({ caseSensitive: v })} />
      <Note>Matched continues to the first step. Not matched continues to the default reply.</Note>
    </>
  );
}

function ChoiceList({
  label,
  items,
  max,
  addLabel,
  placeholder,
  onChange,
}: {
  label: string;
  items: { id: string; label: string }[];
  max: number;
  addLabel: string;
  placeholder: string;
  onChange: (items: { id: string; label: string }[]) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="mt-1 space-y-2">
        {items.map((item, i) => (
          <li key={item.id} className="flex gap-2">
            <input
              type="text"
              value={item.label}
              maxLength={60}
              placeholder={placeholder}
              aria-label={`${placeholder} ${i + 1}`}
              aria-invalid={item.label.trim().length === 0}
              onChange={(e) => onChange(items.map((it) => (it.id === item.id ? { ...it, label: e.target.value } : it)))}
              className={`${INPUT} mt-0 ${item.label.trim().length === 0 ? "border-danger" : ""}`}
            />
            <button
              type="button"
              aria-label={`Remove ${placeholder.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(items.filter((it) => it.id !== item.id))}
              className="h-9 shrink-0 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-secondary"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={items.length >= max}
        onClick={() => onChange([...items, { id: newChoiceId(), label: "" }])}
        className={`${SMALL_BUTTON} mt-2 w-full`}
      >
        {addLabel}
      </button>
    </div>
  );
}

function newChoiceId() {
  return `c-${Math.random().toString(36).slice(2, 10)}`;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">{children}</p>;
}
