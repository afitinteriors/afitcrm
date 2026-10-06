import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  BUILDER_GRAPH_VERSION,
  NEXT_PORT,
  getPorts,
  type BuilderGraph,
  type BuilderNodeData,
  type BuilderNodeType,
  type FlowIssue,
} from "@/lib/automations/builder-graph";

// Client-side view of the builder graph. xyflow owns positions and selection;
// everything that is saved lives in the BuilderGraph shape (builder-graph.ts).

export type FlowNodeData = BuilderNodeData & { nodeType: BuilderNodeType; hasIssue?: boolean };
export type FlowNodeType = Node<FlowNodeData, "flowNode">;
export type FlowEdgeType = Edge;

export type FlowSnapshot = { nodes: FlowNodeType[]; edges: FlowEdgeType[] };

export function graphToFlow(graph: BuilderGraph): FlowSnapshot {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: "flowNode",
      position: { x: n.position.x, y: n.position.y },
      data: { ...n.data, nodeType: n.type },
    })),
    edges: graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
  };
}

export function flowToGraph(nodes: FlowNodeType[], edges: FlowEdgeType[], publishedAt: string | null): BuilderGraph {
  return {
    version: BUILDER_GRAPH_VERSION,
    meta: { publishedAt },
    nodes: nodes.map((n) => {
      const data: Partial<FlowNodeData> = { ...n.data };
      const type = data.nodeType ?? "trigger";
      delete data.nodeType;
      delete data.hasIssue;
      return { id: n.id, type, position: { x: n.position.x, y: n.position.y }, data: data as BuilderNodeData };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? NEXT_PORT,
    })),
  };
}

// Presentation-only decoration applied just before rendering. It never changes
// saved state: it flags nodes with validation issues, labels branch edges with
// their port name, and hides connections whose port no longer exists (those
// stay in state so validation can report them as broken).
export function decorateFlow(
  snapshot: FlowSnapshot,
  issues: FlowIssue[]
): { nodes: FlowNodeType[]; edges: FlowEdgeType[]; hiddenEdgeCount: number } {
  const issueNodeIds = new Set(issues.map((i) => i.nodeId).filter((id): id is string => !!id));
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));

  // The keyword trigger is the start of the service's flow, so the canvas can't
  // delete it (keyboard or otherwise). Its edges are then kept as well.
  const nodes = snapshot.nodes.map((n) => {
    const data = issueNodeIds.has(n.id) ? { ...n.data, hasIssue: true } : n.data;
    return { ...n, data, deletable: n.data.nodeType !== "trigger" };
  });

  let hiddenEdgeCount = 0;
  const edges: FlowEdgeType[] = [];
  for (const edge of snapshot.edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    const handle = edge.sourceHandle ?? NEXT_PORT;
    const port = source ? getPorts(source.data.nodeType, source.data).find((p) => p.id === handle) : undefined;
    if (!source || !target || !port || target.data.nodeType === "trigger") {
      hiddenEdgeCount += 1;
      continue;
    }
    const ports = getPorts(source.data.nodeType, source.data);
    edges.push({
      ...edge,
      type: "smoothstep",
      label: ports.length > 1 ? port.label : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      style: { strokeWidth: 1.75 },
    });
  }
  return { nodes, edges, hiddenEdgeCount };
}
