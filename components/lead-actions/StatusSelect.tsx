"use client";

import { useState, useTransition } from "react";
import { setLeadStatus } from "@/lib/actions/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/constants";
import type { LeadStatus } from "@/lib/supabase/types";

export function StatusSelect({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <label
        htmlFor="status-select"
        className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Live Stage
      </label>
      <select
        id="status-select"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as LeadStatus;
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            const result = await setLeadStatus(leadId, next);
            if (result?.error) {
              setError(result.error);
              setValue(previous);
            }
          });
        }}
        className="mt-1 block w-full rounded-md border-2 border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 sm:w-72"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
