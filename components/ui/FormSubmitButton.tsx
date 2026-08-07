"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Shared submit button for `<form action={…}>` server-action call sites.
 * Reads its pending state from `useFormStatus()` so each form gets its own
 * spinner without manual state. The variant set covers the surfaces in use
 * today across the category panel, the income dialog, and the create forms.
 *
 * Adding a new variant: extend `SubmitVariant`, add a `VARIANT_CLASSES` entry
 * — the exhaustive `Record<SubmitVariant, string>` makes a missing entry a
 * compile error. Per-call-site tweaks go through `className`, which is
 * tailwind-merge'd so overriding e.g. padding doesn't fight the preset.
 */
type SubmitVariant =
  | "primary"
  | "compact"
  | "ghost"
  | "destructive"
  | "ghost-destructive";

const VARIANT_CLASSES = {
  primary:
    "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80",
  compact:
    "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80",
  ghost:
    "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive:
    "rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "ghost-destructive":
    "rounded-md px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10",
} as const satisfies Record<SubmitVariant, string>;

export function FormSubmitButton({
  label,
  pendingLabel,
  disabled,
  variant = "primary",
  className,
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  variant?: SubmitVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        VARIANT_CLASSES[variant],
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
