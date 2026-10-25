"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { Card } from "@/components/Card";
import { LEAD_SOURCES, LEAD_SOURCE_LABELS } from "@/lib/constants";
import type { ActionState } from "@/lib/actions/leads";
import type { LeadRow } from "@/lib/supabase/types";

type LeadFormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

export function LeadForm({
  action,
  lead,
  submitLabel,
  saveAndNextAction,
  listContext,
}: {
  action: LeadFormAction;
  lead?: LeadRow;
  submitLabel: string;
  // Edit context only (never passed on the Create Lead form): renders a
  // second "Save & Next" button bound to its own Server Action/state, so a
  // save failure on either button only ever shows on that button's own
  // attempt and never blocks the other.
  saveAndNextAction?: LeadFormAction;
  listContext?: { search?: string; status?: string; campaign?: string };
}) {
  const [state, formAction] = useActionState(action, null);
  // Rules of Hooks: always called. Falls back to `action` when
  // saveAndNextAction isn't provided -- harmless, since the second button
  // (the only thing that could ever dispatch it) then isn't rendered either.
  const [nextState, saveAndNextFormAction] = useActionState(saveAndNextAction ?? action, null);
  const error = state?.error ?? nextState?.error;

  return (
    <form action={formAction} className="space-y-6">
      {lead && <input type="hidden" name="lead_id" value={lead.id} />}
      {saveAndNextAction && listContext?.search && <input type="hidden" name="list_search" value={listContext.search} />}
      {saveAndNextAction && listContext?.status && <input type="hidden" name="list_status" value={listContext.status} />}
      {saveAndNextAction && listContext?.campaign && (
        <input type="hidden" name="list_campaign" value={listContext.campaign} />
      )}

      <Card title="Customer">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <label htmlFor="whatsapp_message" className="block text-xs font-medium text-muted-foreground">
            WhatsApp message
          </label>
          <textarea
            id="whatsapp_message"
            name="whatsapp_message"
            defaultValue={lead?.whatsapp_message ?? ""}
            rows={3}
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </Card>

      <Card title="Project">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="source" className="block text-xs font-medium text-muted-foreground">
              Source
            </label>
            <select
              id="source"
              name="source"
              defaultValue={lead?.source ?? "whatsapp"}
              className="mt-1 block h-11 w-full rounded-md border border-border bg-card px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
      </Card>

      {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        {saveAndNextAction && (
          <SubmitButton
            formAction={saveAndNextFormAction}
            pendingLabel="Saving…"
            className="h-11 rounded-md border border-border bg-secondary px-4 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save &amp; Next
          </SubmitButton>
        )}
      </div>
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
      <label htmlFor={name} className="block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
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
        className="mt-1 block h-11 w-full rounded-md border border-border px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
