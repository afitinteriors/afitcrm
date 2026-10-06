"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FlowNode } from "@/components/automation-builder/FlowNode";
import { PALETTE_DRAG_TYPE } from "@/components/automation-builder/NodePalette";
import type { FlowNodeType } from "@/components/automation-builder/flow-model";
import {
  BUILDER_NODE_TYPES,
  type BuilderNodeType,
} from "@/lib/automations/builder-graph";

const nodeTypes = { flowNode: FlowNode };

export type CanvasProps = {
  nodes: FlowNodeType[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<FlowNodeType>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onReconnectStart: (edgeId: string | null) => void;
  onReconnect: (oldEdge: Edge, connection: Connection) => void;
  isValidConnection: (connection: Connection | Edge) => boolean;
  onNodeDragStart: () => void;
  onNodeDragStop: () => void;
  onAddNodeAt: (type: BuilderNodeType, position: { x: number; y: number }) => void;
  onInit: (instance: ReactFlowInstance<FlowNodeType, Edge>) => void;
};

function CanvasInner(props: CanvasProps) {
  const { nodes, edges, onInit } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow<FlowNodeType, Edge>();
  const [dropActive, setDropActive] = useState(false);

  const handleDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropActive(true);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      setDropActive(false);
      const type = event.dataTransfer.getData(PALETTE_DRAG_TYPE) as BuilderNodeType;
      if (!(BUILDER_NODE_TYPES as readonly string[]).includes(type)) return;
      event.preventDefault();
      const bounds = wrapperRef.current?.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: event.clientX - (bounds?.left ?? 0),
        y: event.clientY - (bounds?.top ?? 0),
      });
      props.onAddNodeAt(type, position);
    },
    [props, screenToFlowPosition]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!props.isValidConnection(connection)) return;
      props.onConnect(connection);
    },
    [props]
  );

  const onlyEmptyStart = nodes.length <= 1 && edges.length === 0;

  return (
    <div
      ref={wrapperRef}
      className={`relative min-h-0 flex-1 bg-background ${dropActive ? "ring-2 ring-inset ring-primary/60" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
      }}
      onDrop={handleDrop}
    >
      <ReactFlow<FlowNodeType, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={props.onNodesChange}
        onEdgesChange={props.onEdgesChange}
        onConnect={onConnect}
        onReconnectStart={(_, edge) => props.onReconnectStart(edge.id)}
        onReconnect={(oldEdge, connection) => {
          if (props.isValidConnection(connection)) props.onReconnect(oldEdge, connection);
        }}
        onReconnectEnd={() => props.onReconnectStart(null)}
        isValidConnection={(connection) => props.isValidConnection(connection)}
        onNodeDragStart={props.onNodeDragStart}
        onNodeDragStop={props.onNodeDragStop}
        onInit={(instance) => onInit(instance)}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={1.75}
        snapToGrid
        snapGrid={[10, 10]}
        connectionRadius={36}
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{ type: "smoothstep" }}
        connectionLineStyle={{ strokeWidth: 1.75 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>

      {onlyEmptyStart && (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-6">
          <div className="max-w-sm rounded-xl border border-border bg-card/95 px-5 py-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">Build this flow</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag a block from the left, or click one to add it. Then drag from a block&apos;s output dot to connect it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function FlowCanvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

