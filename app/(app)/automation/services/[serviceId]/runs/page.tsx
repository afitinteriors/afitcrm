import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getServicesWithConfig, getAutomationRunsForService } from "@/lib/automations/admin-data";
import { Card } from "@/components/Card";
import type { AutomationRunStatus } from "@/lib/supabase/types";

// Admin-only, same page-level pattern as /automation/services and
// /automation/services/[serviceId]/builder -- automation_runs RLS
// (admin-only SELECT) is the real enforcement; this is defense in depth,
// not a substitute for it.

const STATUS_LABEL: Record<AutomationRunStatus, string> = {
  pending: "Pending",
  matched: "Matched",
  no_match: "No match",
  failed: "Failed",
};

const STATUS_CLASS: Record<AutomationRunStatus, string> = {
  pending: "bg-secondary text-muted-foreground",
  matched: "bg-success-soft text-success",
  no_match: "bg-secondary text-muted-foreground",
  failed: "bg-danger-soft text-danger",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AutomationRunsPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const { serviceId } = await params;
  const services = await getServicesWithConfig();
  const service = services.find((s) => s.id === serviceId);
  if (!service) notFound();

  const runs = await getAutomationRunsForService(serviceId);

  return (
    <div>
      <Link
        href="/automation/services"
        className="text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        ← Keyword Triggers
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-foreground">{service.name} — Run History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The most recent {runs.length === 50 ? "50" : runs.length} inbound message{runs.length === 1 ? "" : "s"} matched
        or considered for this service, most recent first — whether the automation actually ran, and why it
        didn&apos;t when it didn&apos;t.
      </p>

      {runs.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          No runs recorded yet for this service.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {runs.map((run) => (
            <Card key={run.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[run.status]}`}
                    >
                      {STATUS_LABEL[run.status]}
                    </span>
                    {run.matched_keyword && (
                      <span className="text-xs text-muted-foreground">
                        keyword &ldquo;{run.matched_keyword}&rdquo;
                      </span>
                    )}
                  </div>
                  {run.conversationWaId && (
                    <Link
                      href={`/conversations/${run.conversation_id}`}
                      className="block text-sm font-medium text-foreground hover:underline"
                    >
                      {run.conversationWaId}
                    </Link>
                  )}
                  {run.error_message && <p className="text-xs text-danger">{run.error_message}</p>}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(run.created_at)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
