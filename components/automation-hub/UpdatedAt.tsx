"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// Formats an ISO timestamp in the viewer's own time zone. Renders a neutral
// placeholder on the server and first paint, so server and browser time zones
// can never produce a hydration mismatch.
export function UpdatedAt({ value }: { value: string | null }) {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  if (!value) return <span className="text-muted-foreground">Never</span>;
  return (
    <time dateTime={value} className="whitespace-nowrap text-muted-foreground">
      {isClient ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "…"}
    </time>
  );
}
