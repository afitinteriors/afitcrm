import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getServicesWithConfig } from "@/lib/automations/admin-data";
import { AutomationHub } from "@/components/automation-hub/AutomationHub";

// Automation Hub (DB-backed). Admin-only: a non-admin gets a 404 here, and
// getServicesWithConfig() also returns nothing for a non-admin caller. Replaces
// the old local-state prototype, which is no longer imported (its files are
// left in place for now).
export default async function AutomationPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const services = await getServicesWithConfig();

  return <AutomationHub services={services} />;
}
