"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState } from "react";

import { NET_WORTH_ACTION_INITIAL, type NetWorthActionState } from "@/app/actions/net-worth-state";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { MODAL_BACKDROP, MODAL_POPUP } from "@/components/ui/dialogClasses";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";

type AccountAction = (
  prev: NetWorthActionState,
  formData: FormData,
) => Promise<NetWorthActionState>;

/**
 * Confirm-step dialog for a destructive account action — close or delete (#109
 * chunk 7, stories 15/16). Owns its own action state (so the parent only tracks
 * open/close), submits the account `id` to the given chunk-5 action, and on
 * success toasts, closes, and calls `onSuccess` (the edit sheet closes itself,
 * since the account has left the live view). Mirrors `DeleteCategoryDialog`.
 */
export function AccountActionDialog({
  open,
  onOpenChange,
  accountId,
  title,
  description,
  confirmLabel,
  pendingLabel,
  successMessage,
  action,
  dateValue,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  accountId: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  successMessage: string;
  action: AccountAction;
  /**
   * When set, submitted as `date` — the client's *local* calendar day, so a
   * close records its final snapshot under the user's today, not the server's
   * UTC one (chunk 5 reserves the UTC `todayIso()` as a last resort for callers
   * that omit this). Only the close variant passes it; delete needs no date.
   */
  dateValue?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, NET_WORTH_ACTION_INITIAL);
  useActionSuccessToast(state, () => successMessage, () => {
    onOpenChange(false);
    onSuccess?.();
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={MODAL_BACKDROP} />
        <Dialog.Popup className={MODAL_POPUP}>
          <Dialog.Title className="font-heading text-lg font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          <form action={formAction} className="mt-5 flex justify-end gap-2">
            <input type="hidden" name="id" value={accountId} />
            {dateValue && <input type="hidden" name="date" value={dateValue} />}
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Cancel
            </Dialog.Close>
            <FormSubmitButton label={confirmLabel} pendingLabel={pendingLabel} variant="destructive" />
          </form>
          {state.error && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {state.error}
            </p>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
