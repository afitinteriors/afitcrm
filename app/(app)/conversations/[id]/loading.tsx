function BubbleSkeleton({ align }: { align: "start" | "end" }) {
  return (
    <div className={`flex ${align === "end" ? "justify-end" : "justify-start"}`}>
      <div className="h-10 w-48 animate-pulse rounded-xl bg-slate-200" />
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-hidden bg-slate-50 p-3">
      <BubbleSkeleton align="start" />
      <BubbleSkeleton align="start" />
      <BubbleSkeleton align="end" />
      <BubbleSkeleton align="start" />
    </div>
  );
}

export default function ConversationDetailLoading() {
  return (
    <>
      <div className="flex h-[calc(100vh-13rem)] flex-col lg:hidden">
        <div className="flex animate-pulse items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
          <div className="h-10 w-10 rounded-full bg-slate-100" />
          <div className="h-9 w-9 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        </div>
        <ThreadSkeleton />
      </div>

      <div className="hidden h-full lg:flex lg:gap-4">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="animate-pulse border-b border-slate-200 px-4 py-3">
            <div className="h-3.5 w-40 rounded bg-slate-200" />
          </div>
          <ThreadSkeleton />
        </div>
        <div className="w-72 shrink-0 animate-pulse rounded-xl border border-slate-200 bg-white shadow-sm" />
      </div>
    </>
  );
}
