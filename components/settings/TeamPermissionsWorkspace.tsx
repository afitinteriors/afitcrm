"use client";

import { useState } from "react";
import type { StaffOption } from "@/lib/staff";
import { PERMISSION_GROUPS, type PermissionKey, type TeamMemberDraft } from "@/lib/settings/team-permissions";
import { TeamMemberFormModal } from "@/components/settings/TeamMemberFormModal";

type Row = { id: string; name: string; role: "admin" | "staff" | "draft" };

export function TeamPermissionsWorkspace({ team }: { team: StaffOption[] }) {
  const [drafts, setDrafts] = useState<TeamMemberDraft[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Set<PermissionKey>>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const rows: Row[] = [
    ...team.map((m) => ({ id: m.id, name: m.display_name || "Unnamed", role: m.role })),
    ...drafts.map((d) => ({ id: d.id, name: d.name, role: "draft" as const })),
  ];

  function togglePermission(memberId: string, key: PermissionKey) {
    setPermissions((prev) => {
      const current = new Set(prev[memberId] ?? []);
      if (current.has(key)) current.delete(key);
      else current.add(key);
      return { ...prev, [memberId]: current };
    });
  }

  function toggleExpanded(memberId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function handleAddDraft(member: TeamMemberDraft) {
    setDrafts((prev) => [...prev, member]);
    setShowAddModal(false);
    setBanner(`${member.name} added to this preview.`);
  }

  return (
    <div>
      {banner && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-success/30 bg-success-soft px-4 py-2.5 text-sm font-medium text-success">
          {banner}
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss" className="text-success/70 hover:text-success">
            &times;
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          This view is a preview of team management and checkbox-level permissions — nothing here is saved yet.
          Admins already have full access by default; checkboxes here would grant staff extra capabilities beyond
          their assigned leads.
        </p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Add team member
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No team members found.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <RoleBadge role={row.role} />
                </div>

                {row.role === "admin" ? (
                  <p className="text-xs text-muted-foreground">Full access (Admin role)</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleExpanded(row.id)}
                    className="flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"
                  >
                    {expanded.has(row.id) ? "Hide permissions" : "Edit permissions"}
                    {(permissions[row.id]?.size ?? 0) > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {permissions[row.id]!.size}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {row.role !== "admin" && expanded.has(row.id) && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
                  {PERMISSION_GROUPS.map((group) => (
                    <fieldset key={group.label} className="m-0 border-0 p-0">
                      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</legend>
                      <div className="mt-1.5 space-y-1.5">
                        {group.items.map((item) => (
                          <label key={item.key} className="flex min-h-9 items-start gap-2 text-sm text-foreground">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={permissions[row.id]?.has(item.key) ?? false}
                              onChange={() => togglePermission(row.id, item.key)}
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAddModal && <TeamMemberFormModal onSave={handleAddDraft} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

function RoleBadge({ role }: { role: Row["role"] }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-foreground">
        Admin
      </span>
    );
  }
  if (role === "draft") {
    return (
      <span className="inline-flex items-center rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
        Preview — not a real account
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
      Staff
    </span>
  );
}
