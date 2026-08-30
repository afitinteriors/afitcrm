"use client";

import { useEffect, useState } from "react";
import type { StaffOption } from "@/lib/staff";
import {
  NUMBER_PURPOSES,
  formatPhoneForDisplay,
  type NumberPurpose,
  type WhatsAppNumber,
} from "@/lib/settings/whatsapp-numbers";

const ADD_STEPS = ["Connect", "Purpose", "Assign", "Default", "Review"] as const;

type FormState = {
  label: string;
  phoneNumber: string;
  purpose: NumberPurpose;
  assignAll: boolean;
  assignedStaffIds: string[];
  isDefault: boolean;
};

function initialState(number: WhatsAppNumber | null): FormState {
  if (number) {
    return {
      label: number.label,
      phoneNumber: number.phoneNumber,
      purpose: number.purpose,
      assignAll: number.assignedStaffIds.length === 0,
      assignedStaffIds: number.assignedStaffIds,
      isDefault: number.isDefault,
    };
  }
  return { label: "", phoneNumber: "", purpose: "General", assignAll: true, assignedStaffIds: [], isDefault: false };
}

export function NumberFormModal({
  mode,
  number,
  staff,
  hasExistingDefault,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  number: WhatsAppNumber | null;
  staff: StaffOption[];
  hasExistingDefault: boolean;
  onSave: (number: WhatsAppNumber) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => initialState(number));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggleStaff(id: string) {
    setForm((f) => ({
      ...f,
      assignedStaffIds: f.assignedStaffIds.includes(id)
        ? f.assignedStaffIds.filter((s) => s !== id)
        : [...f.assignedStaffIds, id],
    }));
  }

  function handleConnectNext() {
    if (!form.label.trim()) return setError("Give this number a name, e.g. “Sales Line”.");
    if (form.phoneNumber.replace(/\D/g, "").length < 10) return setError("Enter a valid phone number with country code.");
    setError(null);
    setStep(1);
  }

  function submit() {
    onSave({
      id: number?.id ?? crypto.randomUUID(),
      label: form.label.trim(),
      phoneNumber: mode === "add" ? formatPhoneForDisplay(form.phoneNumber) : form.phoneNumber,
      status: number?.status ?? "connected",
      purpose: form.purpose,
      assignedStaffIds: form.assignAll ? [] : form.assignedStaffIds,
      isDefault: form.isDefault,
    });
  }

  const title = mode === "add" ? `Add WhatsApp Number — ${ADD_STEPS[step]}` : `Manage ${number?.label}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lg sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            &times;
          </button>
        </div>

        {mode === "add" && (
          <div className="mt-3 flex gap-1.5">
            {ADD_STEPS.map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {mode === "edit" && (
            <p className="text-xs text-muted-foreground">
              Number: <span className="font-medium tabular-nums text-foreground">{form.phoneNumber}</span> (connecting a
              different number requires disconnecting this one first)
            </p>
          )}

          {mode === "add" && step === 0 && (
            <>
              <Field label="What should we call this number?">
                <input
                  autoFocus
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Sales Line"
                  className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <Field label="WhatsApp number">
                <input
                  value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  placeholder="e.g. 91 98765 43210"
                  className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                Connecting this number with WhatsApp is completed separately — this just registers it here.
              </p>
              {error && <p className="text-xs font-medium text-danger">{error}</p>}
            </>
          )}

          {mode === "edit" && (
            <Field label="Name">
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </Field>
          )}

          {(mode === "edit" || step === 1) && <PurposeField form={form} setForm={setForm} />}
          {(mode === "edit" || step === 2) && <AssignField form={form} setForm={setForm} staff={staff} toggleStaff={toggleStaff} />}
          {(mode === "edit" || step === 3) && (
            // Editing the number that's already the default shouldn't warn that
            // checking the box will "replace" a default -- it already is one.
            <DefaultField form={form} setForm={setForm} hasExistingDefault={hasExistingDefault && !number?.isDefault} />
          )}

          {mode === "add" && step === 4 && (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/50 p-3 text-sm">
              <ReviewRow label="Name" value={form.label} />
              <ReviewRow label="Number" value={formatPhoneForDisplay(form.phoneNumber)} />
              <ReviewRow label="Purpose" value={form.purpose} />
              <ReviewRow label="Assigned to" value={form.assignAll ? "All staff" : `${form.assignedStaffIds.length} staff member(s)`} />
              <ReviewRow label="Default number" value={form.isDefault ? "Yes" : "No"} />
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-between gap-2">
          {mode === "add" && step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary">
              Back
            </button>
          ) : (
            <button type="button" onClick={onClose} className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary">
              Cancel
            </button>
          )}

          {mode === "add" && step < ADD_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => (step === 0 ? handleConnectNext() : setStep((s) => s + 1))}
              className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Next
            </button>
          ) : (
            <button type="button" onClick={submit} className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              {mode === "add" ? "Add number" : "Save changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// For a group of controls (buttons, radios, checkboxes) rather than a single
// input -- a <label> can only ever describe one form control, so wrapping a
// whole button group in one (as Field does) produces a garbled combined
// accessible name for every button inside it. <fieldset>/<legend> is the
// correct grouping semantics here.
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="block border-0 p-0 m-0">
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="mt-1">{children}</div>
    </fieldset>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function PurposeField({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <FieldGroup label="What is this number mainly used for?">
      <div className="flex flex-wrap gap-2">
        {NUMBER_PURPOSES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={form.purpose === p}
            onClick={() => setForm((f) => ({ ...f, purpose: p }))}
            className={`flex h-11 items-center rounded-full px-4 text-sm font-medium ${
              form.purpose === p ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </FieldGroup>
  );
}

function AssignField({
  form,
  setForm,
  staff,
  toggleStaff,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  staff: StaffOption[];
  toggleStaff: (id: string) => void;
}) {
  return (
    <FieldGroup label="Who should use this number?">
      <div className="space-y-2">
        <label className="flex h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
          <input type="radio" name="assign-mode" checked={form.assignAll} onChange={() => setForm((f) => ({ ...f, assignAll: true }))} />
          All staff
        </label>
        <label className="flex h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
          <input type="radio" name="assign-mode" checked={!form.assignAll} onChange={() => setForm((f) => ({ ...f, assignAll: false }))} />
          Specific staff
        </label>
        {!form.assignAll && (
          <div className="ml-1 space-y-1 border-l-2 border-border pl-3">
            {staff.length === 0 && <p className="py-1 text-xs text-muted-foreground">No staff accounts yet.</p>}
            {staff.map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.assignedStaffIds.includes(s.id)} onChange={() => toggleStaff(s.id)} />
                {s.display_name || "Unnamed staff"}
              </label>
            ))}
          </div>
        )}
      </div>
    </FieldGroup>
  );
}

function DefaultField({
  form,
  setForm,
  hasExistingDefault,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  hasExistingDefault: boolean;
}) {
  return (
    <FieldGroup label="Default number">
      <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.isDefault}
          onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
        />
        <span>
          Make this the default number for new conversations.
          {form.isDefault && hasExistingDefault && (
            <span className="mt-1 block text-xs text-muted-foreground">This will replace the current default number.</span>
          )}
        </span>
      </label>
    </FieldGroup>
  );
}
