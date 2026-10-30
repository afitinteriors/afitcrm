"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffOption } from "@/lib/staff";
import { PERMISSION_GROUPS, type PermissionKey, type TeamMemberFormValues } from "@/lib/settings/team-permissions";
import {
  setPermissionGrant,
  inviteTeamMember,
  deactivateTeamMember,
  reactivateTeamMember,
  setTelegramUsername,
} from "@/lib/actions/team-permissions";
import { TeamMemberFormModal } from "@/components/settings/TeamMemberFormModal";

function toPermissionSets(grants: Record<string, PermissionKey[]>): Record<string, Set<PermissionKey>> {
  const sets: Record<string, Set<PermissionKey>> = {};
  for (const [id, keys] of Object.entries(grants)) sets[id] = new Set(keys);
  return sets;
}

// `team` and `grants` both come from the server (getAllTeamMembers() /
// getAllPermissionGrants()) against the real `profiles` and
// `profile_permissions` tables -- there is no local-only preview state
// left in this component (Blueprint Phase 1, supabase/migrations/
// 20261030160000_team_member_lifecycle.sql): "Add team member" invites a
// real account, "Deactivate" bans the real Supabase Auth account and
// reassigns open leads, see lib/actions/team-permissions.ts for every
// mutation.
export function TeamPermissionsWorkspace({ team, grants }: { team: StaffOption[]; grants: Record<string, PermissionKey[]> }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [permissions, setPermissions] = useState<Record<string, Set<PermissionKey>>>(() => toPermissionSets(grants));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [editingTelegramId, setEditingTelegramId] = useState<string | null>(null);
  const [telegramDraft, setTelegramDraft] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function togglePermission(memberId: string, key: PermissionKey) {
    const current = permissions[memberId] ?? new Set<PermissionKey>();
    const willGrant = !current.has(key);

    // Optimistic: flip it locally right away so the checkbox never lags
    // behind the click, matching this project's other admin write flows.
    setPermissions((prev) => {
      const next = new Set(prev[memberId] ?? []);
      if (willGrant) next.add(key);
      else next.delete(key);
      return { ...prev, [memberId]: next };
    });

    setError(null);
    startTransition(async () => {
      const result = await setPermissionGrant(memberId, key, willGrant);
      if ("error" in result) {
        // Revert the optimistic flip on failure.
        setPermissions((prev) => {
          const next = new Set(prev[memberId] ?? []);
          if (willGrant) next.delete(key);
          else next.add(key);
          return { ...prev, [memberId]: next };
        });
        setError(result.error);
        return;
      }
      router.refresh();
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

  function handleInvite(values: TeamMemberFormValues) {
    setAddError(null);
    startTransition(async () => {
      const result = await inviteTeamMember({
        name: values.name,
        email: values.email,
        role: values.role,
        telegramUsername: values.telegramUsername || undefined,
      });
      if ("error" in result) {
        setAddError(result.error);
        return;
      }
      setShowAddModal(false);
      setBanner(`Invite sent to ${values.email}.`);
      router.refresh();
    });
  }

  function confirmDeactivate(memberId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deactivateTeamMember(memberId, reassignTo || null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDeactivatingId(null);
      setReassignTo("");
      setBanner(
        result.reassignedLeadCount > 0
          ? `Deactivated. ${result.reassignedLeadCount} open lead${result.reassignedLeadCount === 1 ? "" : "s"} reassigned.`
          : "Deactivated.",
      );
      router.refresh();
    });
  }

  function handleReactivate(memberId: string) {
    setError(null);
    startTransition(async () => {
      const result = await reactivateTeamMember(memberId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBanner("Reactivated.");
      router.refresh();
    });
  }

  function saveTelegramUsername(memberId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setTelegramUsername(memberId, telegramDraft);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEditingTelegramId(null);
      router.refresh();
    });
  }

  const otherActiveMembers = (excludeId: string) => team.filter((m) => m.id !== excludeId && m.active);

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
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm font-medium text-danger">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-danger/70 hover:text-danger">
            &times;
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Admins already have full access by default; checkboxes here grant an existing staff member extra
          capabilities beyond their assigned leads.
        </p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Add team member
        </button>
      </div>

      {team.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No team members found.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {team.map((member) => (
            <li key={member.id} className={`rounded-xl border border-border bg-card p-4 shadow-sm ${member.active ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{member.display_name || "Unnamed"}</p>
                  <RoleBadge role={member.role} />
                  {!member.active && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Deactivated
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {member.role === "admin" && member.active && (
                    <p className="text-xs text-muted-foreground">Full access (Admin role)</p>
                  )}
                  {member.role !== "admin" && member.active && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(member.id)}
                      className="flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      {expanded.has(member.id) ? "Hide permissions" : "Edit permissions"}
                      {(permissions[member.id]?.size ?? 0) > 0 && (
                        <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {permissions[member.id]!.size}
                        </span>
                      )}
                    </button>
                  )}
                  {member.active ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setDeactivatingId(member.id);
                        setReassignTo("");
                      }}
                      className="flex h-9 items-center rounded-md border border-danger/30 px-3 text-xs font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleReactivate(member.id)}
                      className="flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Telegram:</span>
                {editingTelegramId === member.id ? (
                  <>
                    <input
                      autoFocus
                      value={telegramDraft}
                      onChange={(e) => setTelegramDraft(e.target.value)}
                      placeholder="username"
                      disabled={isPending}
                      className="h-7 w-36 rounded border border-border px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button type="button" onClick={() => saveTelegramUsername(member.id)} disabled={isPending} className="font-medium text-primary hover:underline">
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingTelegramId(null)} disabled={isPending} className="text-muted-foreground hover:underline">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-foreground">{member.telegram_username ? `@${member.telegram_username}` : "not set"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTelegramId(member.id);
                        setTelegramDraft(member.telegram_username ?? "");
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>

              {deactivatingId === member.id && (
                <div className="mt-3 rounded-lg border border-danger/30 bg-danger-soft p-3">
                  <p className="text-xs font-medium text-danger">
                    Deactivate {member.display_name || "this member"}? They lose sign-in access immediately. Their open leads move to:
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={reassignTo}
                      onChange={(e) => setReassignTo(e.target.value)}
                      disabled={isPending}
                      className="h-9 rounded-md border border-border bg-card px-2 text-xs"
                    >
                      <option value="">Leave unassigned</option>
                      {otherActiveMembers(member.id).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.display_name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => confirmDeactivate(member.id)}
                      className="flex h-9 items-center rounded-md bg-danger px-3 text-xs font-semibold text-danger-foreground hover:bg-danger/90 disabled:opacity-60"
                    >
                      Confirm deactivate
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setDeactivatingId(null)}
                      className="flex h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {member.role !== "admin" && expanded.has(member.id) && (
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
                              disabled={isPending}
                              checked={permissions[member.id]?.has(item.key) ?? false}
                              onChange={() => togglePermission(member.id, item.key)}
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

      {showAddModal && (
        <TeamMemberFormModal
          isPending={isPending}
          error={addError}
          onSave={handleInvite}
          onClose={() => {
            setShowAddModal(false);
            setAddError(null);
          }}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: "admin" | "staff" }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-foreground">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
      Staff
    </span>
  );
}
