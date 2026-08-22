import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getActorOptions, getAuditLogs, type AuditLogListItem } from "@/lib/audit-logs";
import { AuditLogFilterBar } from "@/components/AuditLogFilterBar";
import { formatDateTime, labelize } from "@/lib/format";

// Explicit check, on top of audit_logs_select_admin_only (RLS) -- same
// "don't rely on the database alone" discipline used everywhere else in
// this app (see lib/actions/leads.ts's checkLeadAccess). A staff request
// here gets notFound(), not an empty/confusing table.
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") notFound();

  const params = await searchParams;
  const action = params.action ?? "";
  const actorId = params.actor ?? "";

  const [logs, actorOptions] = await Promise.all([
    getAuditLogs({ action, actorId }),
    getActorOptions(),
  ]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Audit Log</h1>

      <div className="mt-4">
        <AuditLogFilterBar action={action} actorId={actorId} actorOptions={actorOptions} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Timestamp</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Actor</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Action</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Target</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <AuditLogTableRow key={log.id} log={log} />
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No audit events match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TARGET_LINK_PREFIX: Record<string, string> = {
  lead: "/leads",
  conversation: "/conversations",
};

function AuditLogTableRow({ log }: { log: AuditLogListItem }) {
  const linkPrefix = log.target_type ? TARGET_LINK_PREFIX[log.target_type] : undefined;

  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-2 text-slate-700">{formatDateTime(log.created_at)}</td>
      <td className="whitespace-nowrap px-4 py-2 text-slate-700">
        {log.actor?.display_name || "—"}
        {log.actor?.role && <span className="ml-1 text-xs text-slate-400">({log.actor.role})</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-slate-700">{labelize(log.action)}</td>
      <td className="whitespace-nowrap px-4 py-2 text-slate-700">
        {log.target_type ? labelize(log.target_type) : "—"}
        {log.target_id && (
          <>
            {" "}
            {linkPrefix ? (
              <Link href={`${linkPrefix}/${log.target_id}`} className="text-xs text-blue-600 hover:underline">
                view
              </Link>
            ) : (
              <span className="text-xs text-slate-400">{log.target_id.slice(0, 8)}</span>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-2 text-slate-500">
        {log.metadata
          ? Object.entries(log.metadata)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
              .join(" · ")
          : "—"}
      </td>
    </tr>
  );
}
