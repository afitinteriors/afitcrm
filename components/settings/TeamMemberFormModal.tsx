"use client";

import { useEffect, useState } from "react";
import type { TeamMemberDraft } from "@/lib/settings/team-permissions";

export function TeamMemberFormModal({
  onSave,
  onClose,
}: {
  onSave: (member: TeamMemberDraft) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function submit() {
    if (!name.trim()) return setError("Enter a name.");
    if (mobile.replace(/\D/g, "").length < 10) return setError("Enter a valid mobile number.");
    if (!email.trim().includes("@")) return setError("Enter a valid email.");
    setError(null);
    onSave({ id: crypto.randomUUID(), name: name.trim(), mobile: mobile.trim(), email: email.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add team member"
        className="flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-lg sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Add team member</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            &times;
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          This is a preview — it does not create a real sign-in account yet. Real staff creation needs its own
          separate approval.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul K."
              className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label="Mobile">
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="e.g. 91 98765 43210"
              className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add to preview
          </button>
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
