function RowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-3.5 w-32 rounded bg-slate-200" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-24 rounded bg-slate-100" /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-slate-100" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-20 rounded bg-slate-100" /></td>
      <td className="px-4 py-3"><div className="h-3.5 w-16 rounded bg-slate-100" /></td>
    </tr>
  );
}

function CardSkeleton() {
  return (
    <li className="mx-0 my-2.5 grid animate-pulse grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-2xl border border-l-4 border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="h-11 w-11 rounded-full bg-slate-200" />
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-4 w-14 rounded-full bg-slate-100" />
      </div>
      <div className="h-4 w-4 rounded bg-slate-100" />
      <div className="col-span-3 h-3 w-40 rounded bg-slate-100" />
      <div className="col-span-2 h-3 w-48 rounded bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-11 w-11 rounded-full bg-slate-100" />
        <div className="h-11 w-11 rounded-full bg-slate-100" />
      </div>
    </li>
  );
}

export default function LeadsLoading() {
  return (
    <div>
      <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-10 animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Customer</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Phone</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Campaign</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 lg:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
