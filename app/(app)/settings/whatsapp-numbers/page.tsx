import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { getAssignableStaff } from "@/lib/staff";
import { WhatsAppNumbersWorkspace } from "@/components/settings/WhatsAppNumbersWorkspace";

// Admin-only, same pattern as /automation and /audit-log: explicit
// page-level check on top of what would become admin-only RLS if this data
// ever moves to a real table (never solve a security problem by only
// hiding a nav link).
export default async function WhatsAppNumbersPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const staff = await getAssignableStaff();

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-xs font-medium text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-foreground">WhatsApp Numbers</span>
      </nav>

      <h1 className="mt-2 text-xl font-semibold text-foreground">WhatsApp Numbers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        See which numbers are connected, who handles each one, and which number new conversations use by default.
      </p>

      <div className="mt-6">
        <WhatsAppNumbersWorkspace staff={staff} />
      </div>
    </div>
  );
}
