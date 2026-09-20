"use client";

import { useEffect } from "react";

// Registers the (cache-free) service worker in production only. Runs after
// mount so it never blocks rendering; failures are swallowed on purpose.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
