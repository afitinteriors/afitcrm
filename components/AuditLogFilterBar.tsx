import Link from "next/link";
import { labelize } from "@/lib/format";
import { AUDIT_ACTIONS, type ActorOption } from "@/lib/audit-logs";

export function AuditLogFilterBar({
  action,
  actorId,
  actorOptions,
}: {
  action: string;
  actorId: string;
  actorOptions: ActorOption[];
}) {
  return (
    <form
      method="get"
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end"
    >
      <div className="sm:w-56">
        <label htmlFor="action" className="block text-xs font-medium text-slate-500">
          Action
        </label>
        <select
          id="action"
          name="action"
          defaultValue={action}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((value) => (
            <option key={value} value={value}>
              {labelize(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:w-56">
        <label htmlFor="actor" className="block text-xs font-medium text-slate-500">
          Actor
        </label>
        <select
          id="actor"
          name="actor"
          defaultValue={actorId}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        >
          <option value="">All actors</option>
          {actorOptions.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.display_name || actor.role}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Filter
        </button>
        {(action || actorId) && (
          <Link
            href="/audit-log"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </Link>
        )}
      </div>
    </form>
  );
}
