"use client";

import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  addEdge,
  useReactFlow,
  type Connection,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AutomationNodeCard, CanvasActionsContext } from "@/components/automation/canvas/AutomationNodeCard";
import { defaultDataForKind, type AutomationEdge, type AutomationNode, type NodeKind } from "@/lib/automation/types";

const nodeTypes = { automationNode: AutomationNodeCard };

let nodeIdCounter = 0;
function nextNodeId() {
  nodeIdCounter += 1;
  return `node-${Date.now()}-${nodeIdCounter}`;
}

function isValidConnection(connection: Connection | AutomationEdge): boolean {
  if (connection.source === connection.target) return false;
  return true;
}

function CanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  service,
  selectedId,
  onSelect,
  staffById,
}: {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  onNodesChange: (nodes: AutomationNode[]) => void;
  onEdgesChange: (edges: AutomationEdge[]) => void;
  service: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  staffById: Record<string, string>;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleNodesChange = useCallback(
    (changes: NodeChange<AutomationNode>[]) => onNodesChange(applyNodeChanges(changes, nodes)),
    [nodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<AutomationEdge>[]) => onEdgesChange(applyEdgeChanges(changes, edges)),
    [edges, onEdgesChange]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;
      onEdgesChange(addEdge({ ...connection, animated: false }, edges));
    },
    [edges, onEdgesChange]
  );

  const addNodeAt = useCallback(
    (kind: NodeKind, position: { x: number; y: number }) => {
      const node: AutomationNode = {
        id: nextNodeId(),
        type: "automationNode",
        position,
        data: defaultDataForKind(kind, service),
      };
      onNodesChange([...nodes, node]);
      onSelect(node.id);
    },
    [nodes, onNodesChange, onSelect, service]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/automation-block") as NodeKind;
      if (!kind) return;
      const bounds = wrapperRef.current?.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      });
      addNodeAt(kind, position);
    },
    [addNodeAt, screenToFlowPosition]
  );

  const handleDelete = useCallback(
    (id: string) => {
      onNodesChange(nodes.filter((n) => n.id !== id));
      onEdgesChange(edges.filter((e) => e.source !== id && e.target !== id));
      if (selectedId === id) onSelect(null);
    },
    [nodes, edges, onNodesChange, onEdgesChange, selectedId, onSelect]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const source = nodes.find((n) => n.id === id);
      if (!source) return;
      const clone: AutomationNode = {
        ...source,
        id: nextNodeId(),
        position: { x: source.position.x + 40, y: source.position.y + 40 },
        selected: false,
      };
      onNodesChange([...nodes, clone]);
      onSelect(clone.id);
    },
    [nodes, onNodesChange, onSelect]
  );

  return (
    <div
      ref={wrapperRef}
      className="relative min-h-0 flex-1 bg-slate-50"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
    >
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-500">Build your customer journey</p>
          <p className="mt-1 text-sm text-slate-400">Drag a block from the left to get started.</p>
        </div>
      )}

      <CanvasActionsContext.Provider value={{ onDelete: handleDelete, onDuplicate: handleDuplicate, staffById }}>
        <ReactFlow<AutomationNode, AutomationEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          isValidConnection={isValidConnection}
          onNodeClick={(_, node) => onSelect(node.id)}
          onPaneClick={() => onSelect(null)}
          fitView={nodes.length > 0}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </CanvasActionsContext.Provider>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            onClick={() => addNodeAt("trigger_new_message", { x: 80, y: 160 })}
            className="pointer-events-auto rounded-lg border-2 border-dashed border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm hover:border-blue-400 hover:text-blue-600"
          >
            💬 New WhatsApp Message
          </button>
        </div>
      )}
    </div>
  );
}

export function AutomationCanvas(props: {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  onNodesChange: (nodes: AutomationNode[]) => void;
  onEdgesChange: (edges: AutomationEdge[]) => void;
  service: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  staffById: Record<string, string>;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

export function createAddBlockHandler(
  nodes: AutomationNode[],
  onNodesChange: (nodes: AutomationNode[]) => void,
  onSelect: (id: string | null) => void,
  service: string
) {
  return (kind: NodeKind) => {
    const index = nodes.length;
    const column = index % 3;
    const row = Math.floor(index / 3);
    const node: AutomationNode = {
      id: nextNodeId(),
      type: "automationNode",
      position: { x: 80 + column * 300, y: 120 + row * 180 },
      data: defaultDataForKind(kind, service),
    };
    onNodesChange([...nodes, node]);
    onSelect(node.id);
  };
}
