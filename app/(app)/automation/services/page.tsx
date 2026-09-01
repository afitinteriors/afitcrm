import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getServicesWithConfig } from "@/lib/automations/admin-data";
import { CreateServiceForm } from "@/components/automation-config/CreateServiceForm";
import { ServiceConfigCard } from "@/components/automation-config/ServiceConfigCard";

// Admin-only, same page-level pattern as /automation and /audit-log --
// services/service_keywords/automations RLS (admin-only) is the real
// enforcement; this is defense in depth, not a substitute for it.
export default async function AutomationServicesPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const services = await getServicesWithConfig();

  return (
    <div>
      <Link href="/automation" className="text-xs font-medium text-muted-foreground hover:text-foreground">
        ← Automation
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-foreground">Keyword Triggers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure which inbound WhatsApp keywords resolve to which service, and what that service&apos;s
        active automation does when triggered.
      </p>

      <div className="mt-4">
        <CreateServiceForm />
      </div>

      {services.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No services configured yet.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {services.map((service) => (
            <ServiceConfigCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
