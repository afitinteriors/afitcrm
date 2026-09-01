"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { toggleServiceActive, addKeyword, toggleKeywordActive, deleteKeyword } from "@/lib/actions/automation-config";
import { parseAutomationGraph } from "@/lib/automations/graph-schema";
import { SubmitButton } from "@/components/SubmitButton";
import { Card } from "@/components/Card";
import type { ServiceWithConfig } from "@/lib/automations/admin-data";

function ServiceActiveToggle({ serviceId, isActive }: { serviceId: string; isActive: boolean }) {
  const [state, formAction] = useActionState(toggleServiceActive, null);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="is_active" value={(!isActive).toString()} />
      <SubmitButton
        className={`h-9 rounded-md border px-3 text-xs font-medium ${
          isActive
            ? "border-border text-foreground hover:bg-secondary"
            : "border-success/40 bg-success-soft text-success hover:bg-success-soft/70"
        }`}
        pendingLabel="Saving…"
      >
        {isActive ? "Deactivate service" : "Activate service"}
      </SubmitButton>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

function KeywordRow({ keyword }: { keyword: ServiceWithConfig["keywords"][number] }) {
  const [toggleState, toggleAction] = useActionState(toggleKeywordActive, null);
  const [deleteState, deleteAction] = useActionState(deleteKeyword, null);
  const error = toggleState?.error || deleteState?.error;

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{keyword.keyword}</p>
        <p className="text-xs text-muted-foreground">
          Priority {keyword.priority} · {keyword.is_active ? "Active" : "Inactive"}
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <form action={toggleAction}>
          <input type="hidden" name="keyword_id" value={keyword.id} />
          <input type="hidden" name="is_active" value={(!keyword.is_active).toString()} />
          <SubmitButton className="h-9 rounded-md border border-border px-2 text-xs font-medium hover:bg-secondary" pendingLabel="…">
            {keyword.is_active ? "Deactivate" : "Activate"}
          </SubmitButton>
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="keyword_id" value={keyword.id} />
          <SubmitButton
            className="h-9 rounded-md border border-danger/30 px-2 text-xs font-medium text-danger hover:bg-danger-soft"
            pendingLabel="…"
          >
            Delete
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

function AddKeywordForm({ serviceId }: { serviceId: string }) {
  const [state, formAction, isPending] = useActionState(addKeyword, null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !state?.error) formRef.current?.reset();
    wasPending.current = isPending;
  }, [isPending, state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="service_id" value={serviceId} />
      <div>
        <label htmlFor={`keyword-${serviceId}`} className="block text-xs font-medium text-muted-foreground">
          Keyword
        </label>
        <input
          id={`keyword-${serviceId}`}
          name="keyword"
          type="text"
          required
          placeholder="e.g. AC REPAIR"
          className="mt-1 h-9 w-40 rounded-md border border-border px-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor={`priority-${serviceId}`} className="block text-xs font-medium text-muted-foreground">
          Priority
        </label>
        <input
          id={`priority-${serviceId}`}
          name="priority"
          type="number"
          defaultValue={1}
          className="mt-1 h-9 w-20 rounded-md border border-border px-2 text-sm"
        />
      </div>
      <SubmitButton
        className="h-9 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        pendingLabel="Adding…"
      >
        Add keyword
      </SubmitButton>
      {state?.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}

// Automation content/config now lives entirely in the visual flow builder
// (/automation/services/[serviceId]/builder) -- this is just a read-only
// summary + link, not a second place to edit the same automations row.
function AutomationSummary({
  serviceId,
  automation,
}: {
  serviceId: string;
  automation: ServiceWithConfig["automation"];
}) {
  const isActive = automation?.status === "active";
  const hasLeadAction = (() => {
    if (!automation) return false;
    try {
      return parseAutomationGraph(automation.actions).nodes.some((n) => n.type === "create_or_link_lead");
    } catch {
      return false;
    }
  })();

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation</p>

      <p className="text-sm text-foreground">
        {automation ? (isActive ? "Active" : "Draft") : "Not configured yet"}
      </p>

      {automation && !hasLeadAction && (
        <p className="rounded-md bg-warning-soft px-2 py-1 text-xs text-warning">
          No executable action configured — this automation currently does nothing when triggered.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/automation/services/${serviceId}/builder`}
          className="inline-block h-9 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
        >
          Open flow builder →
        </Link>
        <Link
          href={`/automation/services/${serviceId}/runs`}
          className="inline-block h-9 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
        >
          View run history →
        </Link>
      </div>
    </div>
  );
}

export function ServiceConfigCard({ service }: { service: ServiceWithConfig }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{service.name}</h2>
          <p className="text-xs text-muted-foreground">{service.is_active ? "Active" : "Inactive"}</p>
        </div>
        <ServiceActiveToggle serviceId={service.id} isActive={service.is_active} />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Keywords ({service.keywords.length})
        </p>
        {service.keywords.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No keywords yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {service.keywords.map((k) => (
              <KeywordRow key={k.id} keyword={k} />
            ))}
          </ul>
        )}
        <div className="mt-3">
          <AddKeywordForm serviceId={service.id} />
        </div>
      </div>

      <div className="mt-4">
        <AutomationSummary serviceId={service.id} automation={service.automation} />
      </div>
    </Card>
  );
}
