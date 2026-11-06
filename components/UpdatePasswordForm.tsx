"use client";

import { useActionState, useState } from "react";
import { updatePassword } from "@/lib/auth";
import { EyeIcon, EyeOffIcon, LockIcon } from "@/components/auth-icons";

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">Choose a new password for your account.</p>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
          <LockIcon className="h-5 w-5" />
        </span>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          aria-label="New password"
          placeholder="New password"
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-11 text-sm text-white shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-200"
        >
          {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
          <LockIcon className="h-5 w-5" />
        </span>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          aria-label="Confirm new password"
          placeholder="Confirm new password"
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-green-500 text-sm font-semibold text-white shadow-lg shadow-green-900/30 transition-all hover:from-green-500 hover:to-green-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}
