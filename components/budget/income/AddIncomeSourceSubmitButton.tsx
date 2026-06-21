"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Submit button for the {@link AddIncomeSourceDialog} create form. Split out
 * so the dialog file holds a single component (AGENTS.md principle 1). Reads
 * `useFormStatus` to show a pending label, so it must render inside the
 * dialog's `<form>`.
 */
export function AddIncomeSourceSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60",
      )}
    >
      {pending ? "Adding…" : "Add source"}
    </button>
  );
}
