"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for {@link TransactionForm}. Reads `useFormStatus` to show a
 * pending label during the server action, so it must render inside the form's
 * `<form>`. Disabled until a category is chosen (and while pending).
 */
export function TransactionSubmitButton({
  disabled,
  label,
  pendingLabel,
}: {
  disabled: boolean;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
