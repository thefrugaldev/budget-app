"use client";

import { Dialog } from "@base-ui/react/dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { MODAL_BACKDROP, MODAL_POPUP } from "@/components/ui/dialogClasses";

/**
 * Bulk vendor rename (story 14). The input is prefilled with the most-common
 * vendor in the selection so the common "fix a typo across many rows" case is
 * one keystroke from done. Submitting writes the new vendor to every selected
 * row.
 *
 * When the selection spans more than one vendor — common on the global
 * `/transactions` list — the rename merges them all into one value, which is
 * easy to trigger by accident. A warning names the distinct vendors about to
 * be overwritten so the merge is deliberate, not a surprise.
 */
export function RenameDialog({
  open,
  onOpenChange,
  count,
  noun,
  defaultVendor,
  selectedVendors,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  noun: string;
  defaultVendor: string | undefined;
  selectedVendors: string[];
  onSubmit: (vendor: string) => void;
}) {
  const [value, setValue] = useState("");
  const merging = selectedVendors.length > 1;

  // Prefill (or refresh) the field each time the dialog opens. `open` is driven
  // by parent state rather than a Dialog.Trigger, so Base UI never fires
  // onOpenChange(true); seeding the value on the open-edge during render (the
  // React-sanctioned "adjust state when a prop changes" pattern) is what makes
  // the most-common vendor land in the input reliably.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(defaultVendor ?? "");
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={MODAL_BACKDROP} />
        <Dialog.Popup className={MODAL_POPUP}>
          <Dialog.Title className="font-heading text-lg font-semibold">
            Rename vendor on {count} {noun}
          </Dialog.Title>
          {merging && (
            <div
              role="alert"
              className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Your selection spans {selectedVendors.length} vendors (
                <span className="font-medium">{selectedVendors.join(", ")}</span>). Renaming
                merges them all into the single name below.
              </p>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = value.trim();
              if (trimmed) onSubmit(trimmed);
            }}
            className="mt-4 space-y-4"
          >
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">
                New vendor name
              </span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. Whole Foods Market"
                autoFocus
                className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="rounded-md px-3 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={value.trim() === ""}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
