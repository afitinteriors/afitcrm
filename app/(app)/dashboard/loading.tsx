function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-6 w-12 rounded bg-slate-200" />
    </div>
  );
}

function FollowUpRowSkeleton() {
  return (
    <div className="flex min-h-11 animate-pulse items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3.5 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-1/3 rounded bg-slate-100" />
      </div>
      <div className="h-6 w-16 shrink-0 rounded-md bg-slate-100" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div>
      <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <FollowUpRowSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
