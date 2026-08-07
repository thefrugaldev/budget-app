"use client";

import { Dialog } from "@base-ui/react/dialog";

import { AccountForm } from "@/components/net-worth/AccountForm";
import { DialogFooterCancel } from "@/components/ui/DialogFooter";
import { MODAL_BACKDROP, MODAL_POPUP } from "@/components/ui/dialogClasses";

/**
 * Create-account dialog (#109 chunk 7, story 3): wraps {@link AccountForm} and
 * closes on success. Mirrors `AddCategoryDialog`.
 */
export function AddAccountDialog({
  institutions,
  open,
  onOpenChange,
}: {
  /** The household's prior institution values, for the form's autocomplete. */
  institutions: string[];
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={MODAL_BACKDROP} />
        <Dialog.Popup className={MODAL_POPUP}>
          <Dialog.Title className="font-heading text-lg font-semibold">Add account</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Something you own (cash, investments, property) or owe (a mortgage, a loan).
          </Dialog.Description>
          <div className="mt-4">
            <AccountForm
              institutions={institutions}
              onSuccess={() => onOpenChange(false)}
              cancelSlot={<DialogFooterCancel />}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
