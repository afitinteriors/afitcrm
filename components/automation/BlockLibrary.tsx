"use client";

import { useMemo, useState } from "react";
import { BLOCK_LIBRARY, NODE_CATEGORY_LABELS, type BlockDefinition, type NodeCategory } from "@/lib/automation/types";

const CATEGORY_ORDER: NodeCategory[] = ["trigger", "filter", "action", "message", "flow"];

export function BlockLibrary({ onAddBlock }: { onAddBlock: (kind: BlockDefinition["kind"]) => void }) {
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? BLOCK_LIBRARY.filter((b) => b.label.toLowerCase().includes(term) || b.description.toLowerCase().includes(term))
      : BLOCK_LIBRARY;

    return CATEGORY_ORDER.map((category) => ({
      category,
      blocks: filtered.filter((b) => b.category === category),
    })).filter((group) => group.blocks.length > 0);
  }, [search]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks..."
          aria-label="Search blocks"
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {grouped.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">No blocks match &quot;{search}&quot;.</p>}
        {grouped.map(({ category, blocks }) => (
          <div key={category} className="mb-4">
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {NODE_CATEGORY_LABELS[category]}
            </p>
            <div className="space-y-1.5">
              {blocks.map((block) => (
                <div
                  key={block.kind}
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/automation-block", block.kind);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => onAddBlock(block.kind)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAddBlock(block.kind);
                    }
                  }}
                  title="Drag onto the canvas, or click to add"
                  className="flex cursor-grab items-start gap-2 rounded-md border border-slate-200 px-2.5 py-2 text-left hover:border-slate-300 hover:bg-slate-50 active:cursor-grabbing"
                >
                  <span className="mt-0.5 text-sm leading-none">{block.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-800">{block.label}</span>
                    <span className="block truncate text-[11px] text-slate-400">{block.description}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
