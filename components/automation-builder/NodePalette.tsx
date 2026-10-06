"use client";

import { useMemo, useState } from "react";
import {
  BUILDER_CATEGORY_LABELS,
  BUILDER_NODE_DEFINITIONS,
  BUILDER_NODE_TYPES,
  isTriggerType,
  type BuilderCategory,
  type BuilderNodeType,
} from "@/lib/automations/builder-graph";
import { BuilderIcon } from "@/components/automation-builder/BuilderIcon";

export const PALETTE_DRAG_TYPE = "application/automation-builder-node";

const CATEGORY_ORDER: BuilderCategory[] = ["trigger", "message", "action", "logic"];

// Every block is draggable onto the canvas and also addable with a click, so
// keyboard and touch-less use still works. Filtering is client-side only.
// A flow has exactly one trigger, so while one is on the canvas the trigger
// items are disabled. Dragging or clicking them does nothing.
export function NodePalette({
  onAdd,
  triggerPresent = false,
}: {
  onAdd: (type: BuilderNodeType) => void;
  triggerPresent?: boolean;
}) {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: BUILDER_NODE_TYPES.filter((type) => {
        const def = BUILDER_NODE_DEFINITIONS[type];
        return def.category === category && (q === "" || def.label.toLowerCase().includes(q));
      }),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <aside aria-label="Block library" className="flex w-56 shrink-0 flex-col border-r border-border bg-card xl:w-60">
      <div className="space-y-2 border-b border-border px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Blocks</p>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks"
          aria-label="Search blocks"
          className="block w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {groups.length === 0 && <p className="text-xs text-muted-foreground">No blocks match “{query}”.</p>}
        {groups.map((group) => (
          <div key={group.category}>
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {BUILDER_CATEGORY_LABELS[group.category]}
            </p>
            <ul className="space-y-1">
              {group.items.map((type) => {
                const blocked = triggerPresent && isTriggerType(type);
                return (
                <li key={type}>
                  <button
                    type="button"
                    draggable={!blocked}
                    disabled={blocked}
                    onDragStart={(e) => {
                      if (blocked) return;
                      e.dataTransfer.setData(PALETTE_DRAG_TYPE, type);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => {
                      if (!blocked) onAdd(type);
                    }}
                    title={blocked ? "A flow can have only one trigger" : `Add ${BUILDER_NODE_DEFINITIONS[type].label}`}
                    className={`group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      blocked
                        ? "cursor-not-allowed opacity-40"
                        : "cursor-grab hover:border-border hover:bg-secondary active:cursor-grabbing"
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground group-hover:text-primary">
                      <BuilderIcon type={type} className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{BUILDER_NODE_DEFINITIONS[type].label}</span>
                  </button>
                </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}
