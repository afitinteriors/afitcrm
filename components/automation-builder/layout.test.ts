import { describe, it, expect } from "vitest";
import {
  LAYOUT_GAP,
  LAYOUT_NODE_WIDTH,
  estimateNodeHeight,
  findFreePosition,
  rectsOverlap,
  type LayoutRect,
} from "@/components/automation-builder/layout";

const ORIGIN = { x: 380, y: 80 };

describe("estimateNodeHeight", () => {
  it("is taller for a block with more outputs", () => {
    const threeButtons = estimateNodeHeight("buttons", {
      buttons: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
    });
    expect(threeButtons).toBeGreaterThan(estimateNodeHeight("send_text", { text: "Hi" }));
  });
});

describe("rectsOverlap", () => {
  const a: LayoutRect = { x: 0, y: 0, width: 240, height: 100 };

  it("detects overlapping rectangles", () => {
    expect(rectsOverlap(a, { x: 100, y: 50, width: 240, height: 100 })).toBe(true);
  });

  it("treats rectangles closer than the gap as overlapping", () => {
    const justInside = { x: 240 + LAYOUT_GAP - 1, y: 0, width: 240, height: 100 };
    const clear = { x: 240 + LAYOUT_GAP, y: 0, width: 240, height: 100 };
    expect(rectsOverlap(a, justInside)).toBe(true);
    expect(rectsOverlap(a, clear)).toBe(false);
  });
});

describe("findFreePosition", () => {
  it("starts at the origin when the canvas is empty", () => {
    expect(findFreePosition([], 100)).toEqual(ORIGIN);
  });

  it("moves past a block that already occupies the origin", () => {
    const occupied: LayoutRect[] = [{ x: ORIGIN.x, y: ORIGIN.y, width: LAYOUT_NODE_WIDTH, height: 100 }];
    const next = findFreePosition(occupied, 100);
    expect(next).not.toEqual(ORIGIN);
    expect(occupied.some((r) => rectsOverlap({ ...next, width: LAYOUT_NODE_WIDTH, height: 100 }, r))).toBe(false);
  });

  it("leaves room below a tall measured block instead of landing on it", () => {
    const tall: LayoutRect = { x: ORIGIN.x, y: ORIGIN.y, width: LAYOUT_NODE_WIDTH, height: 320 };
    const next = findFreePosition([tall], 100);
    const candidate: LayoutRect = { ...next, width: LAYOUT_NODE_WIDTH, height: 100 };
    expect(rectsOverlap(candidate, tall)).toBe(false);
  });

  it("never overlaps any earlier placement across many added blocks", () => {
    const placed: LayoutRect[] = [];
    for (let i = 0; i < 25; i++) {
      const height = estimateNodeHeight(i % 3 === 0 ? "buttons" : "send_text", {
        buttons: i % 3 === 0 ? [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }] : undefined,
        text: "x",
      });
      const at = findFreePosition(placed, height);
      const rect: LayoutRect = { x: at.x, y: at.y, width: LAYOUT_NODE_WIDTH, height };
      for (const other of placed) {
        expect(rectsOverlap(rect, other)).toBe(false);
      }
      placed.push(rect);
    }
  });
});
