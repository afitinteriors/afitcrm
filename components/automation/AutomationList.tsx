"use client";

import { useMemo, useState } from "react";
import { getBlockDefinition, type Automation } from "@/lib/automation/types";
import { formatDateTime } from "@/lib/format";

type StatusFilter = "all" | "active" | "draft";

function triggerLabel(automation: Automation): string {
  const trigger = automation.nodes.find((n) => n.data.kind.startsWith("trigger_"));
  return trigger ? getBlockDefinition(trigger.data.kind).label : "No trigger set";
}

export function AutomationList({
  automations,
  onOpen,
  onDuplicate,
  onToggleActive,
  onNew,
}: {
  automations: Automation[];
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleActive: (id: string) => void;
  onNew: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return automations
      .filter((a) => (filter === "all" ? true : a.status === filter))
      .filter((a) => (term ? a.name.toLowerCase().includes(term) || a.service.toLowerCase().includes(term) : true))
      .sort((a, b) => a.priority - b.priority);
  }, [automations, search, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Automation</h1>
          <p className="mt-1 text-sm text-slate-500">Create and manage service-specific customer journeys.</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Create Automation
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search automations..."
          aria-label="Search automations"
          className="w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
          {(["all", "active", "draft"] as StatusFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                filter === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Automation Name</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Service</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Trigger</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Priority</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Updated</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((automation) => (
              <tr key={automation.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(automation.id)}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {automation.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">{automation.service}</td>
                <td className="px-4 py-3 text-slate-600">{triggerLabel(automation)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      automation.status === "active"
                        ? "bg-emerald-100 text-emerald-700 ring-emerald-600/20"
                        : "bg-slate-100 text-slate-600 ring-slate-500/20"
                    }`}
                  >
                    {automation.status === "active" ? "Active" : "Draft"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{automation.priority}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDateTime(automation.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(automation.id)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicate(automation.id)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleActive(automation.id)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        automation.status === "active"
                          ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                          : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {automation.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-900">No automations yet</p>
                  <p className="mt-1 text-sm text-slate-500">Create a rule to automatically route new WhatsApp conversations.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
