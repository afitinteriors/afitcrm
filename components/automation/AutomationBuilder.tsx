"use client";

import { useMemo, useState } from "react";
import { BlockLibrary } from "@/components/automation/BlockLibrary";
import { ConfigPanel } from "@/components/automation/ConfigPanel";
import { AutomationCanvas, createAddBlockHandler } from "@/components/automation/canvas/AutomationCanvas";
import { useStaffLookup } from "@/components/automation/canvas/AutomationNodeCard";
import { validateAutomation } from "@/lib/automation/validation";
import { AUTOMATION_SERVICES, type Automation, type AutomationNodeData } from "@/lib/automation/types";
import type { StaffOption } from "@/lib/staff";

export function AutomationBuilder({
  automation,
  staff,
  onSave,
  onCancel,
}: {
  automation: Automation;
  staff: StaffOption[];
  onSave: (automation: Automation) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Automation>(automation);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const staffById = useStaffLookup(staff);

  const errors = useMemo(() => validateAutomation(draft), [draft]);
  const selectedNode = draft.nodes.find((n) => n.id === selectedId) ?? null;

  function update(patch: Partial<Automation>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function updateSelectedNodeData(patch: Partial<AutomationNodeData>) {
    if (!selectedId) return;
    setDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)),
    }));
  }

  function persist(status: Automation["status"]) {
    onSave({ ...draft, status, updatedAt: new Date().toISOString() });
  }

  const addBlock = createAddBlockHandler(draft.nodes, (nodes) => update({ nodes }), setSelectedId, draft.service);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <button type="button" onClick={onCancel} className="text-xs font-medium text-slate-500 hover:text-slate-700">
          ← Automations
        </button>

        <input
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="Automation name"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />

        <select
          value={draft.service}
          onChange={(e) => update({ service: e.target.value })}
          aria-label="Primary service"
          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          {AUTOMATION_SERVICES.map((service) => (
            <option key={service} value={service}>
              {service}
            </option>
          ))}
        </select>

        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            draft.status === "active"
              ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20"
              : "bg-slate-100 text-slate-600 ring-slate-500/20"
          }`}
        >
          {draft.status === "active" ? "Active" : "Draft"}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTestOpen(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Test
          </button>
          <button
            type="button"
            onClick={() => persist("draft")}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              if (errors.length > 0) {
                setShowErrors(true);
                return;
              }
              persist("active");
            }}
            disabled={errors.length > 0}
            title={errors.length > 0 ? "Fix the issues below before activating" : "Activate this automation"}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Activate
          </button>
        </div>
      </div>

      {showErrors && errors.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2">
          <div className="flex items-start justify-between gap-3">
            <ul className="list-inside list-disc space-y-0.5 text-xs text-red-700">
              {errors.map((err, i) => (
                <li
                  key={i}
                  className={err.nodeId ? "cursor-pointer hover:underline" : undefined}
                  onClick={() => err.nodeId && setSelectedId(err.nodeId)}
                >
                  {err.message}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setShowErrors(false)} className="shrink-0 text-xs text-red-400 hover:text-red-600">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {testOpen && (
        <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          <div className="flex items-start justify-between gap-3">
            <p>
              Dry run only — no WhatsApp message was sent. This journey has {draft.nodes.length} block
              {draft.nodes.length === 1 ? "" : "s"} and {draft.edges.length} connection
              {draft.edges.length === 1 ? "" : "s"}
              {errors.length > 0 ? `, with ${errors.length} issue${errors.length === 1 ? "" : "s"} to fix.` : " and no validation issues."}
            </p>
            <button type="button" onClick={() => setTestOpen(false)} className="shrink-0 text-blue-400 hover:text-blue-600">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <BlockLibrary onAddBlock={addBlock} />
        <AutomationCanvas
          nodes={draft.nodes}
          edges={draft.edges}
          onNodesChange={(nodes) => update({ nodes })}
          onEdgesChange={(edges) => update({ edges })}
          service={draft.service}
          selectedId={selectedId}
          onSelect={setSelectedId}
          staffById={staffById}
        />
        <ConfigPanel node={selectedNode} staff={staff} onChange={updateSelectedNodeData} />
      </div>
    </div>
  );
}
