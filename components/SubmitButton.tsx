"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  pendingLabel,
  formAction,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  // Lets a second submit button in the same <form> invoke a different
  // Server Action (its own useActionState dispatcher) than the form's own
  // `action` -- e.g. Lead Detail's "Save & Next" alongside "Save changes".
  // Omitted, the button falls back to the enclosing form's own action, same
  // as before this prop existed.
  formAction?: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={
        className ??
        "h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}
