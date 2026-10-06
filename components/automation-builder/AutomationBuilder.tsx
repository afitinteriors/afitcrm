"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import { saveAutomationGraph, type SaveAutomationState } from "@/lib/actions/automation-config";
import {
  buildEmptyBuilderGraph,
  isTriggerType,
  parseBuilderGraph,
  validateBuilderGraph,
  NEXT_PORT,
  type BuilderGraph,
  type BuilderNodeData,
  type BuilderNodeType,
} from "@/lib/automations/builder-graph";
import type { ServiceWithConfig } from "@/lib/automations/admin-data";
import type { StaffOption } from "@/lib/staff";
import type { AutomationMediaRow } from "@/lib/supabase/types";
import { FlowCanvas } from "@/components/automation-builder/FlowCanvas";
import { NodePalette } from "@/components/automation-builder/NodePalette";
import { NodeConfigPanel, type NodePatch } from "@/components/automation-builder/NodeConfigPanel";
import { BuilderToolbar, IssuesTray, type SavedStatus } from "@/components/automation-builder/BuilderToolbar";
import { useFlowHistory } from "@/components/automation-builder/useFlowHistory";
import {
  LAYOUT_NODE_WIDTH,
  estimateNodeHeight,
  findFreePosition,
  type LayoutRect,
} from "@/components/automation-builder/layout";
import {
  decorateFlow,
  flowToGraph,
  graphToFlow,
  type FlowNodeData,
  type FlowNodeType,
  type FlowSnapshot,
} from "@/components/automation-builder/flow-model";

const DEFAULT_FLOW_NAME = "Default automation";

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// Rectangles of the blocks already on the canvas. Uses the measured height
// once the canvas has laid a block out, and the estimate until then.
function occupiedRects(nodes: FlowNodeType[]): LayoutRect[] {
  return nodes.map((n) => ({
    x: n.position.x,
    y: n.position.y,
    width: LAYOUT_NODE_WIDTH,
    height: n.measured?.height ?? estimateNodeHeight(n.data.nodeType, n.data),
  }));
}

function defaultDataFor(type: BuilderNodeType): BuilderNodeData {
  if (type === "trigger") return { keywords: [] };
  if (type === "branch") {
    return {
      branchPaths: [
        { id: newId("p"), label: "Path 1" },
        { id: newId("p"), label: "Path 2" },
      ],
    };
  }
  return {};
}

// Copies a block for Duplicate. Choice ids are regenerated so the copy's
// outputs are independent of the original's. Connections are not copied.
function cloneNodeData(data: FlowNodeData): FlowNodeData {
  const copy: FlowNodeData = { ...data };
  delete copy.jumpTargetId;
  delete copy.hasIssue;
  if (copy.buttons) copy.buttons = copy.buttons.map((b) => ({ ...b, id: newId("b") }));
  if (copy.items) copy.items = copy.items.map((i) => ({ ...i, id: newId("i") }));
  if (copy.branchPaths) copy.branchPaths = copy.branchPaths.map((p) => ({ ...p, id: newId("p") }));
  return copy;
}

function loadInitialGraph(raw: unknown): { graph: BuilderGraph; notice: string | null } {
  if (!raw) return { graph: buildEmptyBuilderGraph(), notice: null };
  try {
    return { graph: parseBuilderGraph(raw), notice: null };
  } catch (err) {
    return {
      graph: buildEmptyBuilderGraph(),
      notice: `${err instanceof Error ? err.message : "Couldn't load the previous flow."} A blank flow has been started instead -- save to replace the unreadable one.`,
    };
  }
}

// Stable comparison key for "unsaved changes". The publish stamp is excluded on
// purpose: Publish changes that stamp, and it must not look like an edit.
function snapshotKey(name: string, snapshot: FlowSnapshot): string {
  return JSON.stringify({ name, graph: flowToGraph(snapshot.nodes, snapshot.edges, null) });
}

const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

export function AutomationBuilder({
  service,
  mediaAssets: initialMediaAssets,
  staff,
}: {
  service: ServiceWithConfig;
  mediaAssets: AutomationMediaRow[];
  staff: StaffOption[];
}) {
  const isLive = service.automation?.status === "active";
  const isClient = useIsClient();

  const [initialLoad] = useState(() => loadInitialGraph(service.automation?.actions ?? null));
  const [initialFlow] = useState(() => graphToFlow(initialLoad.graph));
  const history = useFlowHistory(initialFlow);
  const { undo, redo, canUndo, canRedo, update, checkpoint, presentRef } = history;
  const { nodes, edges } = history.present;

  const [mediaAssets, setMediaAssets] = useState(initialMediaAssets);
  const [automationId, setAutomationId] = useState(service.automation?.id ?? "");
  const [publishedAt, setPublishedAt] = useState<string | null>(initialLoad.graph.meta.publishedAt);
  const [flowName, setFlowName] = useState(
    service.automation?.name && service.automation.name !== DEFAULT_FLOW_NAME ? service.automation.name : service.name
  );
  const [savedAt, setSavedAt] = useState<string | null>(service.automation?.updated_at ?? null);
  const [lastSaved, setLastSaved] = useState(() => snapshotKey(flowName, initialFlow));
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [publishNotice, setPublishNotice] = useState<string | null>(null);

  const graph = useMemo(() => flowToGraph(nodes, edges, publishedAt), [nodes, edges, publishedAt]);
  const currentKey = useMemo(() => snapshotKey(flowName, { nodes, edges }), [flowName, nodes, edges]);
  const isDirty = currentKey !== lastSaved;
  const issues = useMemo(() => validateBuilderGraph(graph), [graph]);
  const decorated = useMemo(() => decorateFlow({ nodes, edges }, issues), [nodes, edges, issues]);

  const [state, formAction, isPending] = useActionState<SaveAutomationState, FormData>(saveAutomationGraph, null);
  const submittedKeyRef = useRef("");
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && state && "automationId" in state) {
      setAutomationId(state.automationId);
      setPublishedAt(state.publishedAt);
      setLastSaved(submittedKeyRef.current);
      setSavedAt(new Date().toISOString());
    }
    wasPending.current = isPending;
  }, [isPending, state]);

  const saveError = state && "error" in state ? state.error : null;
  const savedStatus: SavedStatus = publishedAt ? "published" : automationId ? "saved" : "draft";
  const lastUpdatedLabel = !savedAt
    ? "Never saved"
    : isClient
      ? new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "…";

  const selectedNodes = nodes.filter((n) => n.selected);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;

  // Every content edit goes through here. A live flow can be viewed and
  // selected, but nothing that records a change is applied. The server refuses
  // the same writes independently.
  const edit = useCallback(
    (u: FlowSnapshot | ((s: FlowSnapshot) => FlowSnapshot), opts: { record: boolean; key?: string }) => {
      if (isLive && opts.record) return;
      update(u, opts);
    },
    [isLive, update]
  );

  const addNode = useCallback(
    (type: BuilderNodeType, position?: { x: number; y: number }) => {
      edit(
        (s) => {
          const at =
            position ?? findFreePosition(occupiedRects(s.nodes), estimateNodeHeight(type, defaultDataFor(type)));
          const node: FlowNodeType = {
            id: newId(type),
            type: "flowNode",
            position: at,
            data: { nodeType: type, ...defaultDataFor(type) },
            selected: true,
          };
          return { ...s, nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node] };
        },
        { record: true }
      );
    },
    [edit]
  );

  const removeNode = useCallback(
    (id: string) => {
      edit(
        (s) => ({
          ...s,
          nodes: s.nodes
            .filter((n) => n.id !== id)
            .map((n) => (n.data.jumpTargetId === id ? { ...n, data: { ...n.data, jumpTargetId: undefined } } : n)),
          edges: s.edges.filter((e) => e.source !== id && e.target !== id),
        }),
        { record: true }
      );
    },
    [edit]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      edit(
        (s) => {
          const source = s.nodes.find((n) => n.id === id);
          if (!source) return s;
          const copy: FlowNodeType = {
            id: newId(source.data.nodeType),
            type: "flowNode",
            position: findFreePosition(occupiedRects(s.nodes), estimateNodeHeight(source.data.nodeType, source.data)),
            data: cloneNodeData(source.data),
            selected: true,
          };
          return { ...s, nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), copy] };
        },
        { record: true }
      );
    },
    [edit]
  );

  const patchNode: NodePatch = useCallback(
    (id, patch, key) => {
      edit(
        (s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) }),
        { record: true, key }
      );
    },
    [edit]
  );

  const focusNode = useCallback(
    (id: string) => {
      update((s) => ({ ...s, nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })) }), { record: false });
    },
    [update]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNodeType>[]) => {
      const structural = changes.some((c) => c.type === "remove" || c.type === "add");
      edit((s) => ({ ...s, nodes: applyNodeChanges(changes, s.nodes) }), { record: structural });
    },
    [edit]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const structural = changes.some((c) => c.type === "remove");
      edit((s) => ({ ...s, edges: applyEdgeChanges(changes, s.edges) }), { record: structural });
    },
    [edit]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      edit((s) => ({ ...s, edges: addEdge(connection, s.edges) }), { record: true });
    },
    [edit]
  );

  const reconnectingEdgeRef = useRef<string | null>(null);
  const onReconnectStart = useCallback((edgeId: string | null) => {
    reconnectingEdgeRef.current = edgeId;
  }, []);
  const onReconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      edit((s) => ({ ...s, edges: reconnectEdge(oldEdge, connection, s.edges) }), { record: true });
    },
    [edit]
  );

  // One output port carries at most one connection; a trigger can't be a target.
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const { nodes: ns, edges: es } = presentRef.current;
      if (!connection.source || !connection.target || connection.source === connection.target) return false;
      const target = ns.find((n) => n.id === connection.target);
      if (!target || isTriggerType(target.data.nodeType)) return false;
      const handle = connection.sourceHandle ?? NEXT_PORT;
      return !es.some(
        (e) =>
          e.id !== reconnectingEdgeRef.current &&
          e.source === connection.source &&
          (e.sourceHandle ?? NEXT_PORT) === handle
      );
    },
    [presentRef]
  );

  // Drag checkpoints: one undo step per drag, and only if the node really moved.
  const dragStartRef = useRef<FlowSnapshot | null>(null);
  const onNodeDragStart = useCallback(() => {
    dragStartRef.current = presentRef.current;
  }, [presentRef]);
  const onNodeDragStop = useCallback(() => {
    const before = dragStartRef.current;
    dragStartRef.current = null;
    if (!before || isLive) return;
    const after = presentRef.current;
    const moved = after.nodes.some((n) => {
      const prev = before.nodes.find((b) => b.id === n.id);
      return !!prev && (prev.position.x !== n.position.x || prev.position.y !== n.position.y);
    });
    if (moved) checkpoint(before);
  }, [checkpoint, isLive, presentRef]);

  const flowRef = useRef<ReactFlowInstance<FlowNodeType, Edge> | null>(null);
  const fitToScreen = useCallback(() => {
    flowRef.current?.fitView({ padding: 0.25, duration: 200 });
  }, []);

  // Keyboard: Ctrl/Cmd+Z undo, Ctrl+Y or Ctrl+Shift+Z redo, Ctrl/Cmd+D duplicate.
  // Ignored while typing in a field so text editing keeps its own undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (!isLive) undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        if (!isLive) redo();
      } else if (key === "d" && selectedNode) {
        e.preventDefault();
        duplicateNode(selectedNode.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, isLive, selectedNode, duplicateNode]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const hasIssues = issues.length > 0;
  const loadNotice = initialLoad.notice;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <form
        action={formAction}
        onSubmitCapture={() => {
          submittedKeyRef.current = currentKey;
          setPublishNotice(null);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <input type="hidden" name="service_id" value={service.id} />
        <input type="hidden" name="automation_id" value={automationId} />
        <input type="hidden" name="graph" value={JSON.stringify(graph)} readOnly />

        <BuilderToolbar
          serviceName={service.name}
          flowName={flowName}
          onFlowNameChange={setFlowName}
          savedStatus={savedStatus}
          isDirty={isDirty}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onFitToScreen={fitToScreen}
          onDuplicate={() => selectedNode && duplicateNode(selectedNode.id)}
          onDeleteSelected={() => selectedNode && removeNode(selectedNode.id)}
          hasSelection={!!selectedNode}
          hasTriggerSelected={selectedNode?.data.nodeType === "trigger"}
          issueCount={issues.length}
          onToggleIssues={() => setIssuesOpen((v) => !v)}
          onPublishBlocked={() => {
            setIssuesOpen(true);
            setPublishNotice(`Fix ${issues.length} ${issues.length === 1 ? "issue" : "issues"} before publishing.`);
          }}
          readOnly={isLive}
          saveError={saveError}
          publishNotice={publishNotice}
          lastUpdatedLabel={lastUpdatedLabel}
          stepCount={nodes.length}
        />

        {loadNotice && (
          <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-xs text-warning">{loadNotice}</div>
        )}

        <div className="flex min-h-0 flex-1">
          <NodePalette onAdd={(type) => addNode(type)} />

          <div className="relative flex min-w-0 flex-1 flex-col">
            <FlowCanvas
              nodes={decorated.nodes}
              edges={decorated.edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnectStart={onReconnectStart}
              onReconnect={onReconnect}
              isValidConnection={isValidConnection}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onAddNodeAt={(type, position) => addNode(type, position)}
              onInit={(instance) => {
                flowRef.current = instance;
              }}
            />
            {(issuesOpen || hasIssues) && (
              <IssuesTray
                issues={issues}
                open={issuesOpen}
                onToggle={() => setIssuesOpen((v) => !v)}
                onFocus={focusNode}
              />
            )}
          </div>

          <NodeConfigPanel
            node={selectedNode}
            nodes={decorated.nodes}
            edges={decorated.edges}
            issues={issues}
            staff={staff}
            mediaAssets={mediaAssets}
            onPatch={patchNode}
            onMediaUploaded={(asset) => setMediaAssets((prev) => [asset, ...prev])}
            onDelete={removeNode}
            onDuplicate={duplicateNode}
          />
        </div>
      </form>
    </div>
  );
}
