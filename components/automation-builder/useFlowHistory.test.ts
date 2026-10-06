import { describe, it, expect } from "vitest";
import { historyReducer, type HistoryState } from "@/components/automation-builder/useFlowHistory";
import type { FlowSnapshot } from "@/components/automation-builder/flow-model";

const snap = (label: string): FlowSnapshot => ({
  nodes: [{ id: "n", type: "flowNode", position: { x: 0, y: 0 }, data: { nodeType: "send_text", text: label } }],
  edges: [],
});
const textOf = (s: HistoryState) => s.present.nodes[0].data.text;

function start(): HistoryState {
  return { past: [], present: snap("a"), future: [], lastKey: null, lastAt: 0 };
}

describe("historyReducer", () => {
  it("records a change and undoes it back to the previous state", () => {
    let s = historyReducer(start(), { type: "set", update: snap("b"), record: true, at: 1000 });
    expect(textOf(s)).toBe("b");
    s = historyReducer(s, { type: "undo" });
    expect(textOf(s)).toBe("a");
    expect(s.future).toHaveLength(1);
  });

  it("redoes after undo, and a new change clears the redo stack", () => {
    let s = historyReducer(start(), { type: "set", update: snap("b"), record: true, at: 1000 });
    s = historyReducer(s, { type: "undo" });
    s = historyReducer(s, { type: "redo" });
    expect(textOf(s)).toBe("b");

    s = historyReducer(s, { type: "undo" });
    s = historyReducer(s, { type: "set", update: snap("c"), record: true, at: 5000 });
    expect(s.future).toEqual([]);
    expect(textOf(s)).toBe("c");
  });

  it("does not record non-recorded changes (selection, movement)", () => {
    const s = historyReducer(start(), { type: "set", update: snap("b"), record: false, at: 1000 });
    expect(textOf(s)).toBe("b");
    expect(s.past).toEqual([]);
  });

  it("coalesces rapid edits to the same field into one undo step", () => {
    let s = start();
    s = historyReducer(s, { type: "set", update: snap("b"), record: true, key: "text:n", at: 1000 });
    s = historyReducer(s, { type: "set", update: snap("bc"), record: true, key: "text:n", at: 1200 });
    s = historyReducer(s, { type: "set", update: snap("bcd"), record: true, key: "text:n", at: 1400 });
    expect(s.past).toHaveLength(1);
    s = historyReducer(s, { type: "undo" });
    expect(textOf(s)).toBe("a");
  });

  it("does not coalesce a different field, or the same field after the window", () => {
    let s = start();
    s = historyReducer(s, { type: "set", update: snap("b"), record: true, key: "text:n", at: 1000 });
    s = historyReducer(s, { type: "set", update: snap("c"), record: true, key: "label:n", at: 1100 });
    expect(s.past).toHaveLength(2);
    s = historyReducer(s, { type: "set", update: snap("d"), record: true, key: "label:n", at: 5000 });
    expect(s.past).toHaveLength(3);
  });

  it("checkpoints a drag as one step, with the pre-drag state", () => {
    const before = snap("a");
    let s = historyReducer(start(), { type: "set", update: snap("moved-1"), record: false, at: 1 });
    s = historyReducer(s, { type: "set", update: snap("moved-2"), record: false, at: 2 });
    s = historyReducer(s, { type: "checkpoint", snapshot: before });
    expect(s.past).toHaveLength(1);
    s = historyReducer(s, { type: "undo" });
    expect(textOf(s)).toBe("a");
  });

  it("does nothing when there is nothing to undo or redo", () => {
    const s = start();
    expect(historyReducer(s, { type: "undo" })).toBe(s);
    expect(historyReducer(s, { type: "redo" })).toBe(s);
  });

  it("caps the history length", () => {
    let s = start();
    for (let i = 0; i < 150; i++) {
      s = historyReducer(s, { type: "set", update: snap(`v${i}`), record: true, at: i * 10_000 });
    }
    expect(s.past.length).toBe(100);
  });
});
