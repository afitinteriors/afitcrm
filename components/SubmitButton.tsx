"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
