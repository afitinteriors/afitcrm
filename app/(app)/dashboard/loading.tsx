function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-6 w-12 rounded bg-slate-200" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div>
      <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
