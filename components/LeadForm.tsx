"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { LEAD_SOURCES, LEAD_SOURCE_LABELS } from "@/lib/constants";
import type { ActionState } from "@/lib/actions/leads";
import type { LeadRow } from "@/lib/supabase/types";

type LeadFormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

export function LeadForm({
  action,
  lead,
  submitLabel,
}: {
  action: LeadFormAction;
  lead?: LeadRow;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-6">
      {lead && <input type="hidden" name="lead_id" value={lead.id} />}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer name" name="customer_name" defaultValue={lead?.customer_name ?? ""} />
          <Field
            label="Phone"
            name="phone"
            required
            defaultValue={lead?.phone ?? ""}
            placeholder="9876543210"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="whatsapp_message" className="block text-xs font-medium text-slate-500">
            WhatsApp message
          </label>
          <textarea
            id="whatsapp_message"
            name="whatsapp_message"
            defaultValue={lead?.whatsapp_message ?? ""}
            rows={3}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Project</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="source" className="block text-xs font-medium text-slate-500">
              Source
            </label>
            <select
              id="source"
              name="source"
              defaultValue={lead?.source ?? "whatsapp"}
              className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              {LEAD_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {LEAD_SOURCE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <Field label="Campaign" name="campaign_name" defaultValue={lead?.campaign_name ?? ""} />
          <Field label="Location" name="location" defaultValue={lead?.location ?? ""} />
          <Field label="Project type" name="project_type" defaultValue={lead?.project_type ?? ""} />
          <Field
            label="Service required"
            name="service_required"
            defaultValue={lead?.service_required ?? ""}
          />
          <Field
            label="Estimated sq. ft."
            name="estimated_sqft"
            type="number"
            min="0"
            step="1"
            defaultValue={lead?.estimated_sqft ?? ""}
          />
          <Field
            label="Expected start date"
            name="expected_start_date"
            type="date"
            defaultValue={lead?.expected_start_date ?? ""}
          />
          <Field label="Assigned to" name="assigned_to" defaultValue={lead?.assigned_to ?? ""} />
        </div>
      </section>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  min,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-medium text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        step={step}
        defaultValue={defaultValue ?? ""}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </div>
  );
}
