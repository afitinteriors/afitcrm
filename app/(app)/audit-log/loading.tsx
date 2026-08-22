function RowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-3.5 w-32 rounded bg-slate-200" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-24 rounded bg-slate-100" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-28 rounded bg-slate-100" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-slate-100" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-40 rounded bg-slate-100" /></td>
    </tr>
  );
}

export default function AuditLogLoading() {
  return (
    <div>
      <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-10 animate-pulse rounded-lg bg-slate-100" />
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
            {Array.from({ length: 6 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
