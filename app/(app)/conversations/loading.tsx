function RowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 px-4 py-4">
      <div className="h-11 w-11 shrink-0 rounded-full bg-slate-200" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-2/3 rounded bg-slate-200" />
        <div className="h-3 w-1/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function ConversationsLoading() {
  return (
    <>
      <div className="flex h-[calc(100vh-15rem)] flex-col lg:hidden">
        <div className="mb-3 h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      </div>

      <div className="hidden h-full items-center justify-center rounded-xl border border-slate-200 bg-white lg:flex">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </>
  );
}
