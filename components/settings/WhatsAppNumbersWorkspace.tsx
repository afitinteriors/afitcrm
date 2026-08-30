"use client";

import { useState } from "react";
import type { StaffOption } from "@/lib/staff";
import {
  NUMBER_STATUS_BADGE_CLASSES,
  NUMBER_STATUS_LABELS,
  seedWhatsAppNumbers,
  type WhatsAppNumber,
} from "@/lib/settings/whatsapp-numbers";
import { NumberFormModal } from "@/components/settings/NumberFormModal";

function staffNames(staffIds: string[], staff: StaffOption[]): string {
  if (staffIds.length === 0) return "All staff";
  const names = staffIds
    .map((id) => staff.find((s) => s.id === id)?.display_name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : "All staff";
}

export function WhatsAppNumbersWorkspace({ staff }: { staff: StaffOption[] }) {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>(seedWhatsAppNumbers);
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; number: WhatsAppNumber } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  function handleSave(number: WhatsAppNumber) {
    const isNew = !numbers.some((n) => n.id === number.id);

    setNumbers((prev) => {
      const next = isNew ? [...prev, number] : prev.map((n) => (n.id === number.id ? number : n));
      // Only one default at a time -- picking a new default clears the old one.
      return number.isDefault ? next.map((n) => (n.id === number.id ? n : { ...n, isDefault: false })) : next;
    });
    setModal(null);
    setBanner(isNew ? "WhatsApp number added." : "Number updated.");
  }

  function handleSetDefault(id: string) {
    setNumbers((prev) => prev.map((n) => ({ ...n, isDefault: n.id === id })));
    setBanner("Default number updated.");
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
          This view is a preview of the number management experience — nothing here is connected to Meta yet.
        </p>
        <button
          type="button"
          onClick={() => setModal({ mode: "add" })}
          className="flex h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
                      className="flex h-11 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", number })}
                    className="flex h-11 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"
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
