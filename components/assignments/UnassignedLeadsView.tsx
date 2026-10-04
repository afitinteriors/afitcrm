"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkAssignUnassignedLeads } from "@/lib/actions/assignments";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/constants";
import type { StaffWorkloadItem } from "@/lib/assignment-logic";
import type { LeadStatus } from "@/lib/supabase/types";

// Pre-computed on the server (ages and buckets from created_at) so the
// server and client render identical text.
export type UnassignedRowView = {
  id: string;
  customerName: string;
  source: string | null;
  status: LeadStatus;
  createdLabel: string;
  ageLabel: string;
  olderThan24h: boolean;
  createdToday: boolean;
  location: string | null;
  projectType: string | null;
  serviceRequired: string | null;
  valueLabel: string | null;
};

type Pending = { mode: "single"; leadIds: string[]; names: string[] } | { mode: "bulk"; leadIds: string[]; names: string[] };

function uniqueStrings(parts: (string | null)[]) {
  return parts.filter((p): p is string => Boolean(p && p.trim()));
}

export function UnassignedLeadsView({
  rows,
  staff,
  recommendedStaffId,
}: {
  rows: UnassignedRowView[];
  staff: StaffWorkloadItem[];
  recommendedStaffId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending | null>(null);
  const [chosenStaffId, setChosenStaffId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const chosenStaff = useMemo(() => staff.find((s) => s.staffId === chosenStaffId) ?? null, [staff, chosenStaffId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openFor(mode: "single" | "bulk", ids: string[]) {
    const names = rows.filter((r) => ids.includes(r.id)).map((r) => r.customerName);
    setPending({ mode, leadIds: ids, names });
    setChosenStaffId(recommendedStaffId);
    setStep("pick");
    setError(null);
    setMessage(null);
  }

  function closeDialog() {
    if (saving) return;
    setPending(null);
    setStep("pick");
  }

  function confirmAssignment() {
    if (!pending || !chosenStaff) return;
    setError(null);
    startSaving(async () => {
      const result = await bulkAssignUnassignedLeads(pending.leadIds, chosenStaff.staffId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const assignedWord = result.assigned === 1 ? "lead" : "leads";
      const skippedNote = result.skipped > 0 ? ` ${result.skipped} already had an owner and were left unchanged.` : "";
      setMessage(`Assigned ${result.assigned} ${assignedWord} to ${chosenStaff.displayName}.${skippedNote}`);
      setSelected(new Set());
      setPending(null);
      setStep("pick");
      router.refresh();
    });
  }

  const selectedIds = [...selected];
  const questionText =
    pending?.mode === "single"
      ? `Assign ${pending.names[0]} to ${chosenStaff?.displayName ?? "…"}?`
      : `Assign ${pending?.leadIds.length ?? 0} ${pending?.leadIds.length === 1 ? "lead" : "leads"} to ${chosenStaff?.displayName ?? "…"}?`;

  return (
    <div className="space-y-4">
      {message && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-base font-semibold text-foreground">All leads assigned</p>
          <p className="mt-1 text-sm text-muted-foreground">There are no unassigned leads right now.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Oldest first. Select leads to assign several at once, or use Assign on a single lead.</p>
          <ul className="space-y-2.5 pb-24">
            {rows.map((row) => {
              const isSelected = selected.has(row.id);
              const details = uniqueStrings([row.serviceRequired, row.projectType, row.location]).join(" • ");
              return (
                <li key={row.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm">
                  <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(row.id)}
                      aria-label={`Select ${row.customerName}`}
                      className="h-5 w-5 accent-primary"
                    />
                  </label>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="break-words text-sm font-semibold text-foreground">{row.customerName}</p>
                      {row.olderThan24h && (
                        <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">Older than 24h</span>
                      )}
                      {row.createdToday && !row.olderThan24h && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Created today</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.source ? (LEAD_SOURCE_LABELS[row.source] ?? row.source) : "Unknown source"} · {row.createdLabel} · {row.ageLabel}
                    </p>
                    {details && <p className="mt-1 break-words text-xs text-foreground">{details}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Status: {LEAD_STATUS_LABELS[row.status] ?? row.status}
                      {row.valueLabel ? ` · Value: ${row.valueLabel}` : ""}
                    </p>
                    <p className="mt-1 text-xs font-medium text-warning">Assignment status: Unassigned</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openFor("single", [row.id])}
                    className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    Assign
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card px-4 py-3 shadow-lg lg:bottom-0">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {selectedIds.length} selected
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="min-h-11 rounded-full border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => openFor("bulk", selectedIds)}
                className="min-h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Assign selected
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div role="dialog" aria-modal="true" aria-labelledby="assign-dialog-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
            <h2 id="assign-dialog-title" className="text-base font-semibold text-foreground">
              {step === "pick" ? (pending.mode === "single" ? "Choose staff" : `Assign ${pending.leadIds.length} selected`) : "Confirm assignment"}
            </h2>

            {step === "pick" && (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current workload is the number of open leads each staff member already has. There is no configured capacity limit.
                </p>
                <ul className="mt-3 space-y-2">
                  {staff.map((s) => {
                    const active = s.staffId === chosenStaffId;
                    return (
                      <li key={s.staffId}>
                        <button
                          type="button"
                          onClick={() => setChosenStaffId(s.staffId)}
                          aria-pressed={active}
                          className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left ${
                            active ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block break-words text-sm font-semibold text-foreground">{s.displayName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {s.activeLeads} active {s.activeLeads === 1 ? "lead" : "leads"}
                            </span>
                          </span>
                          {staff.length > 1 && s.staffId === recommendedStaffId && (
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Lowest workload
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {staff.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No active staff members to assign to.</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={closeDialog} className="min-h-11 rounded-full border border-border px-4 text-sm font-medium text-foreground">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!chosenStaff}
                    onClick={() => setStep("confirm")}
                    className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <p className="mt-3 text-sm font-medium text-foreground">{questionText}</p>
                {pending.mode === "bulk" && pending.names.length > 0 && (
                  <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs text-muted-foreground">
                    {pending.names.map((n, i) => (
                      <li key={`${n}-${i}`} className="break-words">
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-xs text-muted-foreground">Nothing is changed until you confirm. Leads that already have an owner are left unchanged.</p>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setStep("pick")}
                    disabled={saving}
                    className="min-h-11 rounded-full border border-border px-4 text-sm font-medium text-foreground disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={confirmAssignment}
                    disabled={saving}
                    className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Confirm assignment"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
