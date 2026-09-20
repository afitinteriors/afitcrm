"use client";

import { useTransition } from "react";
import { logout } from "@/lib/auth";
import { revokeCurrentBrowserPush } from "@/lib/push/client";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await revokeCurrentBrowserPush();
          await logout();
        })
      }
      disabled={pending}
      className={
        className ?? "text-sm font-medium text-slate-500 hover:text-slate-900 disabled:opacity-60"
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
