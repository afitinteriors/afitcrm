import { describe, it, expect } from "vitest";
import { historyReducer, type HistoryState } from "@/components/automation-builder/useFlowHistory";
import { cloneNodeData, type FlowNodeData, type FlowSnapshot } from "@/components/automation-builder/flow-model";

const assignSnap = (data: Partial<FlowNodeData>): FlowSnapshot => ({
  nodes: [
    {
      id: "assign",
      type: "flowNode",
      position: { x: 0, y: 0 },
      data: { nodeType: "assign_staff", ...data },
    },
  ],
  edges: [],
});
const dataOf = (s: HistoryState) => s.present.nodes[0].data;

function start(initial: FlowSnapshot): HistoryState {
  return { past: [], present: initial, future: [], lastKey: null, lastAt: 0 };
}

describe("Duplicate keeps Assign Staff configuration", () => {
  it("copies Automatic / Team with no staff member", () => {
    const copy = cloneNodeData({ nodeType: "assign_staff", assignmentMode: "auto_team" });
    expect(copy.assignmentMode).toBe("auto_team");
    expect(copy.staffId).toBeUndefined();
  });

  it("copies Specific mode and its staff member", () => {
    const copy = cloneNodeData({ nodeType: "assign_staff", assignmentMode: "specific", staffId: "s1" });
    expect(copy.assignmentMode).toBe("specific");
    expect(copy.staffId).toBe("s1");
  });
});

describe("Undo/redo keeps Assign Staff configuration", () => {
  it("undo returns to the previous mode and redo restores the change", () => {
    let s = start(assignSnap({ assignmentMode: "specific", staffId: "s1" }));
    s = historyReducer(s, { type: "set", update: assignSnap({ assignmentMode: "auto_team" }), record: true, at: 1000 });
    expect(dataOf(s).assignmentMode).toBe("auto_team");

    s = historyReducer(s, { type: "undo" });
    expect(dataOf(s).assignmentMode).toBe("specific");
    expect(dataOf(s).staffId).toBe("s1");

    s = historyReducer(s, { type: "redo" });
    expect(dataOf(s).assignmentMode).toBe("auto_team");
  });
});
