import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getAssignableStaff } from "@/lib/staff";
import { AutomationWorkspace } from "@/components/automation/AutomationWorkspace";

// Admin-only, same pattern as /audit-log: explicit page-level check on top
// of what will become admin-only RLS in Phase 2 (AGENTS.md: never solve a
// security problem by merely hiding a nav link).
export default async function AutomationPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const staff = await getAssignableStaff();

  return (
    <div>
      {/* Points at the real, DB-backed keyword-trigger configuration screen
          (services/keywords/automation) -- deliberately separate from the
          canvas builder below, which stays a local-state-only prototype
          with no backend wiring. */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm">
        <span className="text-muted-foreground">
          Configure real keyword-triggered automations (services, keywords, and actions) here:
        </span>
        <Link href="/automation/services" className="font-medium text-primary hover:underline">
          Keyword Triggers →
        </Link>
      </div>
      <AutomationWorkspace staff={staff} />
    </div>
  );
}
