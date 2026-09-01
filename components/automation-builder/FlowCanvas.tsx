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
import { FlowNode, type FlowNodeType } from "@/components/automation-builder/FlowNode";
import type { AutomationNodeType } from "@/lib/automations/graph-schema";
import type { Edge } from "@xyflow/react";

const nodeTypes = { flowNode: FlowNode };

function CanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  selectedId,
  onSelect,
  onAddNodeAt,
}: {
  nodes: FlowNodeType[];
  edges: Edge[];
  onNodesChange: (nodes: FlowNodeType[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddNodeAt: (type: AutomationNodeType, position: { x: number; y: number }) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Sequential traversal requires at most one outgoing edge per node -- a
  // node that already has one can't gain a second; the admin deletes the
  // existing edge first (select it, Backspace/Delete, already supported by
  // ReactFlow's own deleteKeyCode below) rather than it being silently
  // replaced or both being kept.
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.source === connection.target) return false;
      return !edges.some((e) => e.source === connection.source);
    },
    [edges]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<FlowNodeType>[]) => onNodesChange(applyNodeChanges(changes, nodes)),
    [nodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => onEdgesChange(applyEdgeChanges(changes, edges)),
    [edges, onEdgesChange]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;
      onEdgesChange(addEdge(connection, edges));
    },
    [edges, onEdgesChange, isValidConnection]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/automation-node-type") as AutomationNodeType;
      if (!type) return;
      const bounds = wrapperRef.current?.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      });
      onAddNodeAt(type, position);
    },
    [onAddNodeAt, screenToFlowPosition]
  );

  return (
    <div
      ref={wrapperRef}
      className="relative min-h-0 flex-1 bg-secondary/30"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
    >
      <ReactFlow<FlowNodeType, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        isValidConnection={isValidConnection}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {selectedId === null && nodes.length <= 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
          <p className="rounded-full bg-card px-4 py-1.5 text-xs text-muted-foreground shadow-sm">
            Click or drag a block from the left to add it to the flow.
          </p>
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: {
  nodes: FlowNodeType[];
  edges: Edge[];
  onNodesChange: (nodes: FlowNodeType[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddNodeAt: (type: AutomationNodeType, position: { x: number; y: number }) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
