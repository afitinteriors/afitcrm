import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getServicesWithConfig, getAutomationMediaAssets } from "@/lib/automations/admin-data";
import { AutomationBuilder } from "@/components/automation-builder/AutomationBuilder";

// Admin-only, same page-level pattern as /automation and /automation/services --
// services/automations RLS (admin-only) is the real enforcement; this is
// defense in depth, not a substitute for it.
export default async function AutomationBuilderPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const { serviceId } = await params;
  const [services, mediaAssets] = await Promise.all([getServicesWithConfig(), getAutomationMediaAssets()]);
  const service = services.find((s) => s.id === serviceId);
  if (!service) notFound();

  return <AutomationBuilder service={service} mediaAssets={mediaAssets} />;
}
