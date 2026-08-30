import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";

// Admin-only, same pattern as /automation and /audit-log. Only one section
// exists so far (WhatsApp Numbers) -- CLAUDE.md §15/§24 confirm Settings is
// a real planned nav destination but everything else in it (Admin/user
// management, etc.) has no spec yet, so this stays a single card rather
// than inventing sections nobody asked for.
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
      </div>
    </div>
  );
}
