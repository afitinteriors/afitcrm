"use client";

import { useEffect, useState } from "react";
import type { TeamMemberFormValues } from "@/lib/settings/team-permissions";

export function TeamMemberFormModal({
  isPending,
  error,
  onSave,
  onClose,
}: {
  isPending: boolean;
  error: string | null;
  onSave: (member: TeamMemberFormValues) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function submit() {
    if (!name.trim()) return setLocalError("Enter a name.");
    if (!email.trim().includes("@")) return setLocalError("Enter a valid email.");
    setLocalError(null);
    onSave({ name: name.trim(), email: email.trim(), role, telegramUsername: telegramUsername.trim() });
  }

  const shownError = localError ?? error;

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
          This sends a real sign-in invite to this email and creates their account.
        </p>

        <div className="mt-4 space-y-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul K."
              disabled={isPending}
              className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              disabled={isPending}
              className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "staff")}
              disabled={isPending}
              className="block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Telegram username (optional)">
            <input
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              placeholder="e.g. rahul_afit"
              disabled={isPending}
              className="block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
          {shownError && <p className="text-xs font-medium text-danger">{shownError}</p>}
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {isPending ? "Inviting…" : "Send invite"}
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
