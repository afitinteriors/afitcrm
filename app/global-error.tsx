"use client";

import { useEffect } from "react";

// Root-level error boundary. Next.js only mounts this in place of the
// ENTIRE app (replacing app/layout.tsx too, hence the full <html>/<body>
// here) when an error escapes every other boundary -- most real errors are
// caught by app/(app)/error.tsx instead, which keeps the sidebar/nav shell
// intact. This is the last resort: a raw Supabase/network failure (or a
// bug) during the root layout's own render, outside any route segment.
// Without this file, that case was a blank, unbranded Next.js default
// error screen with no way back into the app -- it crashed silently, with
// nothing in the UI for the user to act on and nothing recorded anywhere.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side only, deliberately minimal: no error message/stack
    // content (may carry request/user data) beyond what Next.js already
    // attaches as `digest` -- matches this project's logging discipline
    // (CLAUDE.md: never log customer data; keep diagnostics symbolic).
    console.error("[GlobalError]", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-gradient-dark-bg px-6 font-sans antialiased">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 p-6 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/15 text-danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-6 w-6" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-base font-semibold text-white">Something went wrong</h1>
          <p className="mt-1.5 text-sm text-white/60">
            The app hit an unexpected error. Your data is safe -- try again, or reload the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-5 min-h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
