import { describe, it, expect } from "vitest";
import {
  BUILDER_GRAPH_VERSION,
  BuilderGraphError,
  parseBuilderGraph,
  validateBuilderGraph,
  type BuilderEdge,
  type BuilderGraph,
  type BuilderNode,
} from "@/lib/automations/builder-graph";

const node = (id: string, type: BuilderNode["type"], data: BuilderNode["data"] = {}): BuilderNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});
const edge = (id: string, source: string, target: string, sourceHandle = "next"): BuilderEdge => ({
  id,
  source,
  target,
  sourceHandle,
});
const graph = (nodes: BuilderNode[], edges: BuilderEdge[] = []): BuilderGraph => ({
  version: BUILDER_GRAPH_VERSION,
  meta: { publishedAt: null },
  nodes,
  edges,
});

// Minimal fully connected flow: trigger -> assign -> end, with the trigger's
// not-matched path going to a default reply. Only the assign block varies.
function flowWithAssign(assignData: BuilderNode["data"]): BuilderGraph {
  return graph(
    [
      node("t", "trigger", { keywords: ["gypsum"], matchType: "contains" }),
      node("assign", "assign_staff", assignData),
      node("end", "end_flow"),
      node("default", "send_text", { text: "Sorry, I didn't catch that." }),
      node("default-end", "end_flow"),
    ],
    [
      edge("e1", "t", "assign", "matched"),
      edge("e2", "assign", "end"),
      edge("e3", "t", "default", "not_matched"),
      edge("e4", "default", "default-end"),
    ]
  );
}

const assignIssues = (g: BuilderGraph) =>
  validateBuilderGraph(g).filter((i) => i.nodeId === "assign" && i.code === "missing_config");

describe("Assign Staff: validation by assignment mode", () => {
  it("Automatic / Team is valid without an individual staff member", () => {
    expect(validateBuilderGraph(flowWithAssign({ assignmentMode: "auto_team" }))).toEqual([]);
  });

  it("Automatic / Team stays valid even if a stale staff id is still stored", () => {
    expect(validateBuilderGraph(flowWithAssign({ assignmentMode: "auto_team", staffId: "s1" }))).toEqual([]);
  });

  it("Specific Staff Member fails until a staff member is selected", () => {
    const issues = assignIssues(flowWithAssign({ assignmentMode: "specific" }));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/choose a staff member/);
  });

  it("Specific Staff Member is valid once a staff member is selected", () => {
    expect(validateBuilderGraph(flowWithAssign({ assignmentMode: "specific", staffId: "s1" }))).toEqual([]);
  });

  it("an existing block with no mode is still validated as Specific (old invalid state stays invalid)", () => {
    expect(assignIssues(flowWithAssign({}))).toHaveLength(1);
  });

  it("an existing block with no mode and a staff member still validates (old valid graphs stay valid)", () => {
    expect(validateBuilderGraph(flowWithAssign({ staffId: "s1" }))).toEqual([]);
  });
});

describe("Assign Staff: save/load serialization", () => {
  it("preserves Automatic / Team through a JSON round trip", () => {
    const raw = JSON.parse(JSON.stringify(flowWithAssign({ assignmentMode: "auto_team" })));
    const parsed = parseBuilderGraph(raw);
    expect(parsed.nodes.find((n) => n.id === "assign")?.data.assignmentMode).toBe("auto_team");
  });

  it("preserves Specific mode and its staff member through a JSON round trip", () => {
    const raw = JSON.parse(JSON.stringify(flowWithAssign({ assignmentMode: "specific", staffId: "s1" })));
    const data = parseBuilderGraph(raw).nodes.find((n) => n.id === "assign")?.data;
    expect(data?.assignmentMode).toBe("specific");
    expect(data?.staffId).toBe("s1");
  });

  it("rejects an unknown assignment mode instead of silently storing it", () => {
    // Deliberately invalid at the type level: this is what untrusted stored data can contain.
    const raw = JSON.parse(JSON.stringify(flowWithAssign({ assignmentMode: "round_robin" as unknown as "auto_team" })));
    expect(() => parseBuilderGraph(raw)).toThrow(BuilderGraphError);
    expect(() => parseBuilderGraph(raw)).toThrow(/assignmentMode/);
  });

  it("loads an old graph with no mode without error", () => {
    const raw = JSON.parse(JSON.stringify(flowWithAssign({ staffId: "s1" })));
    expect(() => parseBuilderGraph(raw)).not.toThrow();
  });
});
