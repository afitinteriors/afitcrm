import type { RealtimeConnectionState } from "@/lib/realtime/conversations";

// §34: silent when healthy, small and near the list header, existing
// semantic tokens, never color alone -- the label is always present for
// assistive tech, only the visible dot+copy appears once degraded.
export function ConnectionIndicator({ state }: { state: RealtimeConnectionState }) {
  const label =
    state === "reconnecting"
      ? "Live updates: reconnecting"
      : state === "disconnected"
        ? "Live updates: disconnected"
        : "Live updates: connected";

  if (state === "connecting" || state === "connected") {
    return (
      <span className="sr-only" role="status">
        {label}
      </span>
    );
  }

  const isReconnecting = state === "reconnecting";

  return (
    <div className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px]" role="status">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${isReconnecting ? "bg-warning" : "bg-danger"}`}
      />
      <span className={isReconnecting ? "text-warning" : "text-danger"}>
        {isReconnecting ? "Reconnecting…" : "Live updates paused — refresh to check for new messages"}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
