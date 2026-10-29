"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StaffOption } from "@/lib/staff";
import { NUMBER_STATUS_BADGE_CLASSES, NUMBER_STATUS_LABELS } from "@/lib/settings/whatsapp-numbers";
import { saveWhatsAppNumber, setDefaultWhatsAppNumber, type WhatsAppNumber } from "@/lib/actions/whatsapp-numbers";
import { NumberFormModal } from "@/components/settings/NumberFormModal";

function staffNames(staffIds: string[], staff: StaffOption[]): string {
  if (staffIds.length === 0) return "All staff";
  const names = staffIds
    .map((id) => staff.find((s) => s.id === id)?.display_name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : "All staff";
}

// `numbers` comes from the server (getWhatsAppNumbers() -> the real
// whatsapp_numbers table, supabase/migrations/20261029130000_
// whatsapp_numbers.sql) -- this used to seed its own local-only copy
// (seedWhatsAppNumbers()) that reset on every reload; every write below
// now goes through a real server action and router.refresh() re-fetches
// the authoritative list from the server afterwards, the same pattern
// components/assignments/UnassignedLeadsView.tsx already uses. The local
// `numbers` state here is optimistic-UI only (so the list updates the
// instant a save succeeds, without waiting a full round trip) -- it is
// always overwritten by the next server-provided `numbers` prop once the
// page re-renders.
export function WhatsAppNumbersWorkspace({ staff, numbers: initialNumbers }: { staff: StaffOption[]; numbers: WhatsAppNumber[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>(initialNumbers);
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; number: WhatsAppNumber } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSave(number: WhatsAppNumber) {
    const isNew = !numbers.some((n) => n.id === number.id);
    setError(null);
    startTransition(async () => {
      const result = await saveWhatsAppNumber({
        id: isNew ? null : number.id,
        label: number.label,
        phoneNumber: number.phoneNumber,
        purpose: number.purpose,
        assignedStaffIds: number.assignedStaffIds,
        isDefault: number.isDefault,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNumbers((prev) => {
        const next = isNew ? [...prev, result.number] : prev.map((n) => (n.id === result.number.id ? result.number : n));
        return result.number.isDefault ? next.map((n) => (n.id === result.number.id ? n : { ...n, isDefault: false })) : next;
      });
      setModal(null);
      setBanner(isNew ? "WhatsApp number added." : "Number updated.");
      router.refresh();
    });
  }

  function handleSetDefault(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await setDefaultWhatsAppNumber(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNumbers((prev) => prev.map((n) => ({ ...n, isDefault: n.id === id })));
      setBanner("Default number updated.");
      router.refresh();
    });
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
          Connecting a number with Meta is completed separately — this manages what&apos;s registered here.
        </p>
        <button
          type="button"
          onClick={() => setModal({ mode: "add" })}
          disabled={isPending}
          className="flex h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          + Add WhatsApp Number
        </button>
      </div>

      {numbers.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No WhatsApp numbers connected yet.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {numbers.map((number) => (
            <li key={number.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{number.label}</p>
                    {number.isDefault && (
                      <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold-foreground">
                        Default
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${NUMBER_STATUS_BADGE_CLASSES[number.status]}`}
                    >
                      {NUMBER_STATUS_LABELS[number.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">{number.phoneNumber}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{number.purpose}</span>
                    {" · Assigned to "}
                    <span className="font-medium text-foreground">{staffNames(number.assignedStaffIds, staff)}</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!number.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(number.id)}
                      disabled={isPending}
                      className="flex h-11 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", number })}
                    disabled={isPending}
                    className="flex h-11 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary disabled:opacity-60"
                  >
                    Manage
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <NumberFormModal
          mode={modal.mode}
          number={modal.mode === "edit" ? modal.number : null}
          staff={staff}
          hasExistingDefault={numbers.some((n) => n.isDefault)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
