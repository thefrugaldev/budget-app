"use client";

import { Dialog } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

/**
 * The shared action row for every app modal built on Base UI `Dialog` /
 * `AlertDialog`. It owns the canonical footer layout and button treatments so
 * the same Cancel/confirm moment looks and behaves identically everywhere,
 * rather than each modal hand-rolling its own row (the drift #196 fixes).
 *
 * The primitive is a small kit, not one rigid layout: `DialogFooter` is the
 * right-aligned row, `DialogFooterCancel` the standardized dismissal, and
 * `DialogFooterButton` the filled primary/destructive confirm. A caller
 * composes the pieces it needs — a form-driven modal drops `FormSubmitButton`
 * into the same row instead of `DialogFooterButton`, and a read-only surface
 * uses a lone `DialogFooterCancel label="Done"`.
 *
 * Base UI re-exports `AlertDialog.Close` as the very same `Dialog.Close`
 * component, and it reads the dialog context that both `Dialog.Root` and
 * `AlertDialog.Root` provide — so `DialogFooterCancel` works unchanged inside
 * either family without threading the Close element through a prop.
 */

/** Padding + label size shared by Cancel and the primary, so they match. */
const FOOTER_BUTTON_SIZE = "rounded-md px-3 py-2 text-sm font-medium";
const FOOTER_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Right-aligned action row. The default `dialog` variant is a bare row whose
 * top spacing the caller supplies (content-relative). The `sheet` variant adds
 * the pinned-footer chrome the edit sheets use — a `border-t` divider and
 * fixed padding — and renders as a semantic `<footer>` for the sheet's own
 * landmark; sits below the sheet's scroll region rather than inside it.
 */
export function DialogFooter({
  variant = "dialog",
  className,
  children,
}: {
  variant?: "dialog" | "sheet";
  className?: string;
  children: React.ReactNode;
}) {
  const classes = cn(
    "flex justify-end gap-2",
    variant === "sheet" && "items-center border-t border-border px-5 py-3",
    className,
  );
  return variant === "sheet" ? (
    <footer className={classes}>{children}</footer>
  ) : (
    <div className={classes}>{children}</div>
  );
}

/**
 * Canonical ringed-outline dismissal, built on `Dialog.Close` (a pure close —
 * never a mutation). "Cancel" for a modal that commits via an explicit
 * primary; pass `label="Done"` for a read-only surface with no primary.
 */
export function DialogFooterCancel({
  label = "Cancel",
  disabled,
}: {
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Dialog.Close
      disabled={disabled}
      className={cn(
        FOOTER_BUTTON_SIZE,
        "text-foreground ring-1 ring-border hover:bg-muted",
        FOOTER_FOCUS_RING,
      )}
    >
      {label}
    </Dialog.Close>
  );
}

/**
 * Canonical filled confirm button for the non-form case (a plain `<button>`
 * wired to `onClick`); `tone="destructive"` flips it to the destructive
 * palette so dangerous actions stay flagged. Form-driven modals use
 * `FormSubmitButton` (primary variant) in the same row instead.
 */
export function DialogFooterButton({
  tone = "primary",
  type = "button",
  className,
  children,
  ...rest
}: {
  tone?: "primary" | "destructive";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        FOOTER_BUTTON_SIZE,
        FOOTER_FOCUS_RING,
        "disabled:cursor-not-allowed disabled:opacity-50",
        tone === "destructive"
          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          : "bg-primary text-primary-foreground hover:bg-primary/80",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
