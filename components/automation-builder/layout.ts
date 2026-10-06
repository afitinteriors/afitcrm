import { getPorts, type BuilderNodeData, type BuilderNodeType } from "@/lib/automations/builder-graph";

// Placement for blocks added by click or duplicate. Blocks have different
// heights (a Buttons block with three outputs is much taller than Send Text),
// so placement checks real rectangles instead of stepping a fixed grid. That
// is what stops a tall block from landing on the one below it.

export const LAYOUT_NODE_WIDTH = 240;
export const LAYOUT_GAP = 40;
const ORIGIN = { x: 380, y: 80 };
const COLUMN_STEP = 280;
const COLUMNS = 3;
const SCAN_STEP = 40;
const MAX_SCAN_Y = 20000;

export type LayoutRect = { x: number; y: number; width: number; height: number };

// Fallback height when the canvas hasn't measured a block yet: header and
// preview take a fixed block, plus one row for each output.
export function estimateNodeHeight(type: BuilderNodeType, data: BuilderNodeData): number {
  return 104 + getPorts(type, data).length * 28;
}

export function rectsOverlap(a: LayoutRect, b: LayoutRect, gap = LAYOUT_GAP): boolean {
  return (
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap
  );
}

// The part of the flow the user can currently see, in flow coordinates. The
// config panel sits outside the canvas, so it never hides these bounds.
export type VisibleBounds = { minX: number; minY: number; maxX: number; maxY: number };

const VISIBLE_MARGIN = 24;

// First free slot, scanning rows top to bottom and columns left to right.
// When visible bounds are given, slots are searched inside them first, so a new
// block is never placed where the user can't see it. Only if the visible area
// is full does it fall back to the unbounded search.
export function findFreePosition(
  occupied: LayoutRect[],
  height: number,
  visible?: VisibleBounds
): { x: number; y: number } {
  if (visible) {
    const slot = scanFree(occupied, height, {
      fromX: visible.minX + VISIBLE_MARGIN,
      toX: visible.maxX - VISIBLE_MARGIN - LAYOUT_NODE_WIDTH,
      fromY: visible.minY + VISIBLE_MARGIN,
      toY: visible.maxY - VISIBLE_MARGIN - height,
    });
    if (slot) return slot;
  }
  return (
    scanFree(occupied, height, {
      fromX: ORIGIN.x,
      toX: ORIGIN.x + (COLUMNS - 1) * COLUMN_STEP,
      fromY: ORIGIN.y,
      toY: MAX_SCAN_Y,
    }) ?? { x: ORIGIN.x, y: MAX_SCAN_Y }
  );
}

function scanFree(
  occupied: LayoutRect[],
  height: number,
  range: { fromX: number; toX: number; fromY: number; toY: number }
): { x: number; y: number } | null {
  for (let y = range.fromY; y <= range.toY; y += SCAN_STEP) {
    for (let x = range.fromX; x <= range.toX; x += COLUMN_STEP) {
      const candidate: LayoutRect = { x, y, width: LAYOUT_NODE_WIDTH, height };
      if (!occupied.some((rect) => rectsOverlap(candidate, rect))) {
        return { x, y };
      }
    }
  }
  return null;
}
