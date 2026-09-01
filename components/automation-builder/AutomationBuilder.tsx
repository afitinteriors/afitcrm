"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Edge } from "@xyflow/react";
import { saveAutomationGraph, type SaveAutomationState } from "@/lib/actions/automation-config";
import {
  parseAutomationGraph,
  buildEmptyGraph,
  validateGraphForSave,
  type AutomationNodeType,
  type AutomationGraphV2,
  type CapturableLeadField,
} from "@/lib/automations/graph-schema";
import { FlowCanvas } from "@/components/automation-builder/FlowCanvas";
import { NodePalette } from "@/components/automation-builder/NodePalette";
import { NodeConfigPanel } from "@/components/automation-builder/NodeConfigPanel";
import type { FlowNodeType } from "@/components/automation-builder/FlowNode";
import type { ServiceWithConfig } from "@/lib/automations/admin-data";
import type { AutomationMediaRow } from "@/lib/supabase/types";
import { SubmitButton } from "@/components/SubmitButton";

function graphToFlow(
  graph: AutomationGraphV2,
  mediaAssets: AutomationMediaRow[]
): { nodes: FlowNodeType[]; edges: Edge[] } {
  const nameById = new Map(mediaAssets.map((a) => [a.id, a.name]));
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: "flowNode",
      position: n.position,
      data: {
        nodeType: n.type,
        ...(n.data?.fieldKey ? { fieldKey: n.data.fieldKey } : {}),
        ...(n.data?.text ? { text: n.data.text } : {}),
        ...(n.data?.mediaAssetId
          ? { mediaAssetId: n.data.mediaAssetId, mediaAssetName: nameById.get(n.data.mediaAssetId) }
          : {}),
      },
    })),
    edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function flowToGraph(nodes: FlowNodeType[], edges: Edge[]): AutomationGraphV2 {
  return {
    version: 2,
    nodes: nodes.map((n) => {
      const data = {
        ...(n.data.fieldKey ? { fieldKey: n.data.fieldKey } : {}),
        ...(n.data.text ? { text: n.data.text } : {}),
        ...(n.data.mediaAssetId ? { mediaAssetId: n.data.mediaAssetId } : {}),
      };
      return {
        id: n.id,
        type: n.data.nodeType,
        position: n.position,
        ...(Object.keys(data).length > 0 ? { data } : {}),
      };
    }),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

function loadInitialGraph(rawActions: unknown): AutomationGraphV2 {
  try {
    return parseAutomationGraph(rawActions);
  } catch {
    return buildEmptyGraph();
  }
}

let idCounter = 0;
function nextNodeId() {
  idCounter += 1;
  return `node-${Date.now()}-${idCounter}`;
}

export function AutomationBuilder({
  service,
  mediaAssets: initialMediaAssets,
}: {
  service: ServiceWithConfig;
  mediaAssets: AutomationMediaRow[];
}) {
  const wasActiveInitially = service.automation?.status === "active";
  const [mediaAssets, setMediaAssets] = useState(initialMediaAssets);

  const initialGraph = useMemo(
    () => loadInitialGraph(service.automation?.actions ?? null),
    [service.automation]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- initial mount only, mirrors initialGraph's own one-time use
  const initialFlow = useMemo(() => graphToFlow(initialGraph, initialMediaAssets), [initialGraph]);

  const [nodes, setNodes] = useState<FlowNodeType[]>(initialFlow.nodes);
  const [edges, setEdges] = useState<Edge[]>(initialFlow.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(wasActiveInitially);
  const [automationId, setAutomationId] = useState(service.automation?.id ?? "");
  const [lastSaved, setLastSaved] = useState(() => JSON.stringify({ graph: initialGraph, isActive: wasActiveInitially }));

  const [loadNotice] = useState<string | null>(() => {
    if (!service.automation) return null;
    try {
      parseAutomationGraph(service.automation.actions);
      return null;
    } catch (err) {
      return err instanceof Error
        ? `${err.message} A blank flow has been started instead -- save to replace the unreadable one.`
        : "Couldn't load the previous flow -- starting fresh.";
    }
  });

  const [state, formAction, isPending] = useActionState<SaveAutomationState, FormData>(saveAutomationGraph, null);
  const wasPending = useRef(false);

  const currentGraph = useMemo(() => flowToGraph(nodes, edges), [nodes, edges]);
  const currentSnapshot = useMemo(() => JSON.stringify({ graph: currentGraph, isActive }), [currentGraph, isActive]);
  const isDirty = currentSnapshot !== lastSaved;
  const saveError = state && "error" in state ? state.error : null;
  const validationErrors = useMemo(() => validateGraphForSave(currentGraph), [currentGraph]);

  useEffect(() => {
    if (wasPending.current && !isPending && state && "automationId" in state) {
      setAutomationId(state.automationId);
      setLastSaved(currentSnapshot);
    }
    wasPending.current = isPending;
    // currentSnapshot intentionally excluded -- only the snapshot at the
    // moment the pending save resolves should become the new baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  function addNodeAt(type: AutomationNodeType, position: { x: number; y: number }) {
    const node: FlowNodeType = { id: nextNodeId(), type: "flowNode", position, data: { nodeType: type } };
    setNodes((prev) => [...prev, node]);
    setSelectedId(node.id);
  }

  function addNodeCascading(type: AutomationNodeType) {
    const index = nodes.length;
    const column = index % 3;
    const row = Math.floor(index / 3);
    addNodeAt(type, { x: 340 + column * 260, y: 60 + row * 140 });
  }

  function deleteNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateFieldKey(id: string, fieldKey: CapturableLeadField) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, fieldKey } } : n)));
  }

  function updateText(id: string, text: string) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n)));
  }

  function updateMediaAssetId(id: string, mediaAssetId: string) {
    const name = mediaAssets.find((a) => a.id === mediaAssetId)?.name;
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, mediaAssetId, mediaAssetName: name } } : n))
    );
  }

  function handleMediaUploaded(asset: AutomationMediaRow) {
    setMediaAssets((prev) => [asset, ...prev]);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div>
          <Link href="/automation/services" className="text-xs font-medium text-muted-foreground hover:text-foreground">
            ← Keyword Triggers
          </Link>
          <h1 className="text-lg font-semibold text-foreground">{service.name} flow</h1>
        </div>

        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="service_id" value={service.id} />
          <input type="hidden" name="automation_id" value={automationId} />
          <input type="hidden" name="is_active" value={String(isActive)} />
          <input type="hidden" name="graph" value={JSON.stringify(currentGraph)} readOnly />

          {isDirty && <span className="text-xs font-medium text-warning">Unsaved changes</span>}
          {validationErrors.length > 0 && (
            <span className="text-xs font-medium text-warning">{validationErrors[0]}</span>
          )}
          {saveError && <span className="text-xs font-medium text-danger">{saveError}</span>}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4"
            />
            Active
          </label>

          <SubmitButton
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            pendingLabel="Saving…"
          >
            Save
          </SubmitButton>
        </form>
      </div>

      {loadNotice && (
        <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-xs text-warning">{loadNotice}</div>
      )}

      <div className="flex min-h-0 flex-1">
        <NodePalette onAdd={addNodeCascading} />
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={setNodes}
          onEdgesChange={setEdges}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddNodeAt={addNodeAt}
        />
        <NodeConfigPanel
          node={selectedNode}
          onDelete={deleteNode}
          onFieldKeyChange={updateFieldKey}
          onTextChange={updateText}
          mediaAssets={mediaAssets}
          onMediaAssetIdChange={updateMediaAssetId}
          onMediaUploaded={handleMediaUploaded}
        />
      </div>
    </div>
  );
}
