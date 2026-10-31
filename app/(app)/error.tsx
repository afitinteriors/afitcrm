"use client";

import { useEffect } from "react";
import Link from "next/link";

// Catches a render/data error anywhere under the main app shell (app/(app)/
// layout.tsx) -- any page from /dashboard to /reports. Rendered INSIDE that
// layout, so the sidebar/header/bottom-nav stay intact and the user can
// still navigate away; only the page content that actually failed is
// replaced. Before this file, any unhandled error here (e.g. a Supabase
// query throwing, a bad embed shape) fell all the way through to the
// unbranded Next.js default error screen -- see app/global-error.tsx for
// the equivalent one level up, for an error outside this shell entirely.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Symbolic only -- never the error's own message/stack verbatim, which
    // can carry request/customer data (CLAUDE.md: never log customer data).
    console.error("[AppError]", error.digest ?? "unhandled error");
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-6 w-6" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h2 className="mt-4 text-base font-semibold text-foreground">This page hit an error</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Nothing you did caused this, and nothing else in the app was affected. Try again, or go back to the dashboard.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-11 rounded-md border border-border bg-secondary px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
