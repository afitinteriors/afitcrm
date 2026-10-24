import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

// Admin-only, same pattern as /automation and /audit-log. Two sections so
// far: WhatsApp Numbers and Team & Permissions (both UI-only previews, no
// backend yet) -- everything else in Settings still has no spec, so this
// stays a small grid rather than inventing sections nobody asked for.
export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  return (
    <div>
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Admin configuration for this workspace.</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/settings/whatsapp-numbers"
          className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:bg-secondary"
        >
          <p className="text-sm font-semibold text-foreground">WhatsApp Numbers</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connected numbers, staff assignment, and the default number for new conversations.
          </p>
        </Link>

        <Link
          href="/settings/team"
          className="rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:bg-secondary"
        >
          <p className="text-sm font-semibold text-foreground">Team &amp; Permissions</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Who&apos;s on your team, their role, and checkbox-level access to each part of the CRM.
          </p>
        </Link>
      </div>
    </div>
  );
}
