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

// First free slot, scanning rows top to bottom and columns left to right.
export function findFreePosition(occupied: LayoutRect[], height: number): { x: number; y: number } {
  for (let y = ORIGIN.y; y <= MAX_SCAN_Y; y += SCAN_STEP) {
    for (let column = 0; column < COLUMNS; column++) {
      const candidate: LayoutRect = {
        x: ORIGIN.x + column * COLUMN_STEP,
        y,
        width: LAYOUT_NODE_WIDTH,
        height,
      };
      if (!occupied.some((rect) => rectsOverlap(candidate, rect))) {
        return { x: candidate.x, y: candidate.y };
      }
    }
  }
  return { x: ORIGIN.x, y: MAX_SCAN_Y };
}
