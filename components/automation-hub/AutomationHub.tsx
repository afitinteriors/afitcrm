import Link from "next/link";
import type { ServiceWithConfig } from "@/lib/automations/admin-data";
import { deriveFlowStatus, latestUpdatedAt, type FlowStatusKey } from "@/lib/automations/flow-status";
import { CreateServiceForm } from "@/components/automation-config/CreateServiceForm";
import { UpdatedAt } from "@/components/automation-hub/UpdatedAt";

// Automation Hub: the real, DB-backed management layer above the canonical
// builder (/automation/services/[serviceId]/builder) and run history
// (/automation/services/[serviceId]/runs). Read-only apart from the existing
// Add Service form. It never changes services.is_active or automations.status,
// and it has no activate or deactivate control.

const STATUS_TONE: Record<FlowStatusKey, string> = {
  not_configured: "bg-secondary text-muted-foreground",
  draft: "bg-secondary text-foreground",
  published_not_live: "bg-primary/10 text-primary",
  active: "bg-success-soft text-success",
};

const ACTION_LINK =
  "inline-flex h-8 items-center whitespace-nowrap rounded-md border border-border px-2.5 text-xs font-medium text-foreground hover:bg-secondary";

const COLUMNS = ["Service", "Keywords", "Automation", "Status", "Updated", "Actions"];

export function AutomationHub({ services }: { services: ServiceWithConfig[] }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Automation</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage service-specific customer journeys.</p>
        </div>
        <a
          href="#add-service"
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add service
        </a>
      </div>

      <section id="add-service" aria-label="Add service" className="scroll-mt-4">
        <CreateServiceForm />
      </section>

      {services.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">No services yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            An automation starts with a service. A service groups the WhatsApp keywords that route a customer
            to a journey, and each service gets one flow built in the Automation Builder.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-secondary/50">
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceWithConfig }) {
  const automation = service.automation;
  const status = deriveFlowStatus(automation);
  const activeKeywords = service.keywords.filter((k) => k.is_active).length;
  const totalKeywords = service.keywords.length;
  const updated = latestUpdatedAt(service, automation);

  return (
    <tr className="align-middle hover:bg-secondary/30">
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{service.name}</p>
        <span
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
            service.is_active ? "bg-success-soft text-success" : "bg-secondary text-muted-foreground"
          }`}
        >
          {service.is_active ? "Service active" : "Service inactive"}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-foreground">
        {activeKeywords} active
        <span className="text-muted-foreground"> · {totalKeywords} total</span>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{automation ? automation.name : "No flow yet"}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status.key]}`}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3">
        <UpdatedAt value={updated} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Link href={`/automation/services/${service.id}/builder`} className={`${ACTION_LINK} border-primary/40 text-primary hover:bg-primary/5`}>
            Open Builder
          </Link>
          <Link href="/automation/services" className={ACTION_LINK}>
            Manage Keywords
          </Link>
          <Link href={`/automation/services/${service.id}/runs`} className={ACTION_LINK}>
            Run History
          </Link>
        </div>
      </td>
    </tr>
  );
}
