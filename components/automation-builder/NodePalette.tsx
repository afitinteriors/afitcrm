"use client";

import { NODE_DEFINITIONS, type AutomationNodeType } from "@/lib/automations/graph-schema";

// Add-node interaction supports both click (simple, predictable, and what
// Playwright verification drives) and drag-and-drop (matches this app's
// other automation canvas's already-proven drag/drop pattern in
// components/automation/canvas/AutomationCanvas.tsx). Disabled node types
// are visible -- so the intended future shape of a flow is legible -- but
// are neither draggable nor clickable, so nothing that would silently do
// nothing when saved can ever be added to the canvas.
export function NodePalette({ onAdd }: { onAdd: (type: AutomationNodeType) => void }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      <div className="border-b border-border px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blocks</p>
      </div>
      <div className="space-y-2 p-3">
        {NODE_DEFINITIONS.map((def) => (
          <div
            key={def.type}
            draggable={def.enabled}
            onDragStart={(e) => {
              if (!def.enabled) return;
              e.dataTransfer.setData("application/automation-node-type", def.type);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => def.enabled && onAdd(def.type)}
            title={def.enabled ? undefined : def.disabledReason}
            className={
              def.enabled
                ? "cursor-grab rounded-md border border-border bg-background px-3 py-2 text-sm hover:border-primary hover:bg-primary/5 active:cursor-grabbing"
                : "cursor-not-allowed rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm opacity-60"
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{def.label}</span>
              {!def.enabled && (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Coming soon
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{def.enabled ? def.description : def.disabledReason}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
