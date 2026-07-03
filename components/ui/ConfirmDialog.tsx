"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useId, useState } from "react";

import { MODAL_BACKDROP, MODAL_POPUP } from "@/components/ui/dialogClasses";
import { cn } from "@/lib/utils";

/**
 * Reusable confirm modal (Base UI `AlertDialog`): a title + description over a
 * Cancel / confirm footer. Focus lands on Cancel by default (role=alertdialog),
 * so an accidental Enter doesn't fire the action. `tone` switches the confirm
 * button between the primary and destructive palettes; callers compose the
 * `title` / `description` content (including any rich markup or computed copy).
 *
 * `requireType` adds a typed-confirmation gate for the most destructive actions
 * (e.g. the danger-zone reset): the confirm button stays disabled until the
 * user types the exact phrase, so a wipe can't happen on a stray click. The
 * typed value resets whenever the dialog closes.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "primary",
  requireType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: "primary" | "destructive";
  /** When set, the user must type this exact string to enable confirm. */
  requireType?: string;
}) {
  const [typed, setTyped] = useState("");
  const inputId = useId();

  const confirmDisabled = requireType !== undefined && typed !== requireType;

  // Clear the typed value on every close path (Cancel / Escape / backdrop and
  // confirm alike) so a re-opened dialog must re-earn the confirmation. Done in
  // the event handlers, not an effect, to avoid a cascading render.
  function handleOpenChange(next: boolean) {
    if (!next) setTyped("");
    onOpenChange(next);
  }

  function handleConfirm() {
    setTyped("");
    onConfirm();
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={MODAL_BACKDROP} />
        <AlertDialog.Popup className={MODAL_POPUP}>
          <AlertDialog.Title className="font-heading text-lg font-semibold">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {requireType !== undefined ? (
            <div className="mt-4">
              <label htmlFor={inputId} className="block text-sm font-medium">
                Type <span className="font-semibold">{requireType}</span> to
                confirm
              </label>
              <input
                id={inputId}
                type="text"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                className="mt-1 w-full rounded-md bg-background px-3 py-2 text-sm ring-1 ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Close className="rounded-md px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Cancel
            </AlertDialog.Close>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                tone === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/80",
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
