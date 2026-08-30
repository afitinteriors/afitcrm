"use client";

import { useState, useTransition } from "react";
import { assignLead } from "@/lib/actions/leads";
import type { StaffOption } from "@/lib/staff";

export function AssignmentSelect({
  leadId,
  assignedToId,
  staff,
}: {
  leadId: string;
  assignedToId: string | null;
  staff: StaffOption[];
}) {
  const [value, setValue] = useState(assignedToId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The current assignee may not be in this staff-only list (e.g. a lead
  // currently assigned to an admin, or to someone no longer role=staff).
  // Falling back to `!value` alone would let the browser silently render
  // the first real <option> as if it were selected, misleading the admin
  // into thinking that staff member is already the owner.
  const currentIsSelectable = staff.some((s) => s.id === value);

  return (
    <div>
      <label htmlFor="assignment-select" className="block text-xs font-medium text-muted-foreground">
        Assign to staff
      </label>
      <select
        id="assignment-select"
        value={currentIsSelectable ? value : ""}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await assignLead(leadId, next);
            if (result?.error) {
              setError(result.error);
              setValue(previous);
            }
          });
        }}
        className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
      >
        {!currentIsSelectable && (
          <option value="" disabled>
            Select a staff member…
          </option>
        )}
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.display_name || "Unnamed staff"}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
