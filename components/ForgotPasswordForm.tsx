"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth";
import { MailIcon } from "@/components/auth-icons";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);

  if (state && "success" in state) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-slate-300">
          If an account exists for that email, a password reset link is on its way. Check your inbox.
        </p>
        <Link
          href="/login"
          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">
        Enter your account email and we&apos;ll send you a link to reset your password.
      </p>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
          <MailIcon className="h-5 w-5" />
        </span>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          aria-label="Email"
          placeholder="Email"
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
        {pending ? "Sending…" : "Send Reset Link"}
      </button>

      <Link
        href="/login"
        className="block text-center text-sm text-slate-400 transition-colors hover:text-green-400"
      >
        Back to Sign In
      </Link>
    </form>
  );
}
