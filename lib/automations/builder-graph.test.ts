import { describe, it, expect } from "vitest";
import { parseAutomationGraph } from "@/lib/automations/graph-schema";
import {
  BUILDER_GRAPH_VERSION,
  BuilderGraphError,
  buildEmptyBuilderGraph,
  getPorts,
  parseBuilderGraph,
  validateBuilderGraph,
  type BuilderGraph,
  type BuilderNode,
  type BuilderEdge,
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
const codes = (g: BuilderGraph) => validateBuilderGraph(g).map((i) => i.code);

// The example flow from the Automation Builder spec, fully connected and
// configured. Every question has a fallback; Ask Location loops through a
// clarification as the spec describes; the keyword trigger's not-matched path
// leads to a default reply.
function specExampleGraph(): BuilderGraph {
  const nodes: BuilderNode[] = [
    node("t", "trigger", { keywords: ["interior"], matchType: "contains" }),
    node("welcome", "send_text", { text: "Welcome!" }),
    node("video", "send_video", { mediaAssetId: "m1", mediaName: "Intro" }),
    node("q-type", "ask_question", { text: "Project type?", answerType: "text" }),
    node("img", "send_image", { mediaAssetId: "m2", mediaName: "Sample" }),
    node("q-area", "ask_question", { text: "Project area?", answerType: "number" }),
    node("q-loc", "ask_question", { text: "Where is your project located?", answerType: "text" }),
    node("clarify", "send_text", { text: "Please share the city name." }),
    node("q-time", "ask_question", { text: "Timeline?" }),
    node("doc", "send_document", { mediaName: "Company brochure.pdf" }),
    node("q-quote", "ask_question", { text: "Need a quotation?" }),
    node("save", "save_to_crm", { fieldKey: "location", valueSource: "customer_reply" }),
    node("stage", "update_stage", { stage: "qualified" }),
    node("assign", "assign_staff", { staffId: "s1" }),
    node("fu", "create_follow_up", { followUpTitle: "Call back", followUpDueHours: 24 }),
    node("end", "end_flow"),
    node("end-fb", "end_flow"),
    node("default", "send_text", { text: "Sorry, I didn't catch that." }),
  ];
  const chain = ["t", "welcome", "video", "q-type", "img", "q-area", "q-loc", "q-time", "doc", "q-quote", "save", "stage", "assign", "fu", "end"];
  const edges: BuilderEdge[] = [];
  chain.forEach((src, i) => {
    if (i === chain.length - 1) return;
    edges.push(edge(`e-${src}`, src, chain[i + 1], src === "t" ? "matched" : "next"));
  });
  // Fallbacks: questions other than Ask Location end the flow politely.
  for (const q of ["q-type", "q-area", "q-time", "q-quote"]) edges.push(edge(`fb-${q}`, q, "end-fb", "fallback"));
  // Ask Location: fallback -> clarification -> ask again.
  edges.push(edge("fb-q-loc", "q-loc", "clarify", "fallback"));
  edges.push(edge("clarify-back", "clarify", "q-loc", "next"));
  edges.push(edge("not-matched", "t", "default", "not_matched"));
  edges.push(edge("default-end", "default", "end-fb", "next"));
  return graph(nodes, edges);
}

describe("parseBuilderGraph", () => {
  it("round-trips a valid v3 graph", () => {
    const g = specExampleGraph();
    const parsed = parseBuilderGraph(JSON.parse(JSON.stringify(g)));
    expect(parsed.version).toBe(3);
    expect(parsed.nodes.map((n) => n.id)).toEqual(g.nodes.map((n) => n.id));
    expect(parsed.edges).toHaveLength(g.edges.length);
  });

  it("rejects an unknown block type instead of silently dropping it", () => {
    const raw = { version: 3, nodes: [{ id: "x", type: "ai_agent", position: { x: 0, y: 0 } }], edges: [] };
    expect(() => parseBuilderGraph(raw)).toThrow(BuilderGraphError);
  });

  it("rejects an invalid enum value", () => {
    const raw = { version: 3, nodes: [node("t", "trigger", { matchType: "fuzzy" as never })], edges: [] };
    expect(() => parseBuilderGraph(raw)).toThrow(/matchType/);
  });

  it("refuses version 1 and unknown versions", () => {
    expect(() => parseBuilderGraph({ version: 1, steps: [] })).toThrow(BuilderGraphError);
    expect(() => parseBuilderGraph({ version: 9, nodes: [], edges: [] })).toThrow(BuilderGraphError);
  });

  it("rejects two connections from the same output port", () => {
    const raw = graph(
      [node("t", "trigger", { keywords: ["a"] }), node("a", "send_text", { text: "a" }), node("b", "send_text", { text: "b" })],
      [edge("1", "t", "a", "matched"), edge("2", "t", "b", "matched")]
    );
    expect(() => parseBuilderGraph(raw)).toThrow(/only be connected once/);
  });

  it("drops keys a block type does not use", () => {
    const parsed = parseBuilderGraph({
      version: 3,
      nodes: [{ id: "t", type: "trigger", position: { x: 0, y: 0 }, data: { keywords: ["a"], injected: "<script>" } }],
      edges: [],
    });
    expect(parsed.nodes[0].data).toEqual({ keywords: ["a"] });
  });

  it("converts a v2 graph into the v3 vocabulary", () => {
    const v2 = {
      version: 2,
      nodes: [
        { id: "t", type: "trigger", position: { x: 0, y: 0 } },
        { id: "w", type: "send_text", position: { x: 0, y: 0 }, data: { text: "Hi" } },
        { id: "c", type: "capture_lead_field", position: { x: 0, y: 0 }, data: { fieldKey: "location" } },
        { id: "e", type: "end", position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: "1", source: "t", target: "w" },
        { id: "2", source: "w", target: "c" },
        { id: "3", source: "c", target: "e" },
      ],
    };
    const parsed = parseBuilderGraph(v2);
    expect(parsed.version).toBe(3);
    expect(parsed.nodes.find((n) => n.id === "c")).toMatchObject({
      type: "save_to_crm",
      data: { fieldKey: "location", valueSource: "customer_reply" },
    });
    expect(parsed.nodes.find((n) => n.id === "e")?.type).toBe("end_flow");
    expect(parsed.edges.find((e) => e.id === "1")?.sourceHandle).toBe("matched");
  });
});

describe("getPorts", () => {
  it("gives keyword triggers matched and not-matched outputs", () => {
    expect(getPorts("trigger").map((p) => p.id)).toEqual(["matched", "not_matched"]);
  });

  it("gives ask questions a valid-answer and a fallback output", () => {
    expect(getPorts("ask_question").map((p) => p.id)).toEqual(["next", "fallback"]);
  });

  it("gives each button and list option its own output", () => {
    const ports = getPorts("buttons", { buttons: [{ id: "b1", label: "Visit" }, { id: "b2", label: "Quote" }] });
    expect(ports.map((p) => p.id)).toEqual(["b1", "b2"]);
  });

  it("gives end and jump blocks no outputs", () => {
    expect(getPorts("end_flow")).toEqual([]);
    expect(getPorts("jump_to")).toEqual([]);
  });
});

describe("validateBuilderGraph", () => {
  it("accepts the spec example flow with no issues", () => {
    expect(validateBuilderGraph(specExampleGraph())).toEqual([]);
  });

  it("reports a missing trigger", () => {
    expect(codes(graph([node("w", "send_text", { text: "Hi" })]))).toContain("missing_trigger");
  });

  it("reports an empty keyword list and a blank keyword", () => {
    expect(codes(graph([node("t", "trigger", { keywords: [] })]))).toContain("empty_keyword");
    expect(codes(graph([node("t", "trigger", { keywords: ["  "] })]))).toContain("empty_keyword");
  });

  it("reports an empty message on a text block, naming the block", () => {
    const issues = validateBuilderGraph(
      graph([node("t", "trigger", { keywords: ["a"] }), node("w", "send_text", { text: "  " })], [edge("1", "t", "w", "matched")])
    );
    const issue = issues.find((i) => i.code === "empty_message");
    expect(issue?.nodeId).toBe("w");
    expect(issue?.message).toContain("Send Text");
  });

  it("reports a button with no destination, naming the button", () => {
    const buttons = [{ id: "b1", label: "Visit" }, { id: "b2", label: "Quote" }];
    const g = graph(
      [
        node("t", "trigger", { keywords: ["a"] }),
        node("btn", "buttons", { text: "Choose", buttons }),
        node("v", "send_text", { text: "Booked" }),
      ],
      [edge("1", "t", "btn", "matched"), edge("2", "btn", "v", "b1")]
    );
    const issue = validateBuilderGraph(g).find((i) => i.code === "button_no_destination");
    expect(issue?.nodeId).toBe("btn");
    expect(issue?.message).toContain("Quote");
  });

  it("reports an orphan block that nothing leads to", () => {
    const g = graph([node("t", "trigger", { keywords: ["a"] }), node("lost", "send_text", { text: "Hi" })]);
    expect(validateBuilderGraph(g).some((i) => i.code === "orphan_node" && i.nodeId === "lost")).toBe(true);
  });

  it("reports a missing outgoing path on a branch", () => {
    const g = graph(
      [
        node("t", "trigger", { keywords: ["a"] }),
        node("br", "branch", { branchPaths: [{ id: "p1", label: "A" }, { id: "p2", label: "B" }] }),
        node("x", "send_text", { text: "A" }),
      ],
      [edge("1", "t", "br", "matched"), edge("2", "br", "x", "p1")]
    );
    const issue = validateBuilderGraph(g).find((i) => i.code === "missing_outgoing" && i.nodeId === "br");
    expect(issue?.nodeId).toBe("br");
    expect(issue?.message).toContain("B");
  });

  it("reports a broken connection whose output port no longer exists", () => {
    const g = graph(
      [
        node("t", "trigger", { keywords: ["a"] }),
        node("btn", "buttons", { text: "Choose", buttons: [{ id: "b1", label: "Visit" }] }),
        node("v", "send_text", { text: "Booked" }),
      ],
      [edge("1", "t", "btn", "matched"), edge("2", "btn", "v", "removed-button")]
    );
    expect(codes(g)).toContain("broken_connection");
  });

  it("reports a connection into a trigger as broken", () => {
    const g = graph(
      [node("t", "trigger", { keywords: ["a"] }), node("n", "new_message"), node("w", "send_text", { text: "Hi" })],
      [edge("1", "n", "t"), edge("2", "t", "w", "matched")]
    );
    expect(validateBuilderGraph(g).some((i) => i.code === "broken_connection" && i.nodeId === "n")).toBe(true);
  });

  it("reports a jump with no valid target", () => {
    const g = graph(
      [node("t", "trigger", { keywords: ["a"] }), node("j", "jump_to", { jumpTargetId: "gone" })],
      [edge("1", "t", "j", "matched")]
    );
    expect(codes(g)).toContain("missing_config");
  });

  it("requires a fallback path on Ask Question", () => {
    const g = graph(
      [node("t", "trigger", { keywords: ["a"] }), node("q", "ask_question", { text: "Where?" }), node("x", "end_flow")],
      [edge("1", "t", "q", "matched"), edge("2", "q", "x", "next")]
    );
    expect(validateBuilderGraph(g).some((i) => i.code === "missing_outgoing" && i.message.includes("Fallback"))).toBe(true);
  });

  it("requires a media file on image blocks and a file name on document blocks", () => {
    const g = graph(
      [
        node("t", "trigger", { keywords: ["a"] }),
        node("img", "send_image"),
        node("doc", "send_document"),
      ],
      [edge("1", "t", "img", "matched"), edge("2", "img", "doc")]
    );
    const missing = validateBuilderGraph(g).filter((i) => i.code === "missing_config");
    expect(missing.map((i) => i.nodeId).sort()).toEqual(["doc", "img"]);
  });
});

describe("buildEmptyBuilderGraph", () => {
  it("starts with one keyword trigger and no connections", () => {
    const g = buildEmptyBuilderGraph();
    expect(g.nodes.map((n) => n.type)).toEqual(["trigger"]);
    expect(g.edges).toEqual([]);
    expect(g.version).toBe(3);
  });
});

// Execution safety: the live executor (trigger.ts start and session-resume,
// via graph-schema parseAutomationGraph) must never accept a builder graph.
// If this fails, a v3 draft could reach the walk. Do not relax it.
describe("live executor rejects builder (v3) graphs", () => {
  it("throws for a v3 graph, so start and resume fail before any step runs", () => {
    expect(() => parseAutomationGraph(JSON.parse(JSON.stringify(specExampleGraph())))).toThrow(/Unsupported automation actions version: 3/);
    expect(() => parseAutomationGraph({ version: 3, meta: { publishedAt: "2026-10-06T00:00:00Z" }, nodes: [], edges: [] })).toThrow();
  });
});

describe("single trigger rule", () => {
  it("reports a second trigger on that block, and not on the first", () => {
    const g = graph(
      [node("t1", "trigger", { keywords: ["a"], label: "gypsum plastering" }), node("t2", "trigger", { keywords: [] })],
      []
    );
    const dup = validateBuilderGraph(g).filter((i) => i.code === "duplicate_trigger");
    expect(dup.map((i) => i.nodeId)).toEqual(["t2"]);
    expect(dup[0].message).toContain("only one trigger");
  });

  it("reports nothing when there is exactly one trigger", () => {
    const g = graph([node("t1", "trigger", { keywords: ["a"] })], []);
    expect(validateBuilderGraph(g).some((i) => i.code === "duplicate_trigger")).toBe(false);
  });
});
