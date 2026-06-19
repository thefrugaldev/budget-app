"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState } from "react";

import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import {
  type ActionState,
  useActionSuccessToast,
} from "@/hooks/useActionSuccessToast";
import type { Category } from "@/types/budget";

/**
 * Server-action signature accepted by `DeleteCategoryDialog`. The dialog
 * only reads `ok` and `error`, so callers can hand any action whose state
 * shape extends `ActionState` (e.g. `deleteCategoryAction` returns the
 * wider `CategoryActionState`, `deleteIncomeSourceAction` returns
 * `IncomeActionState`).
 */
type DeleteAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Confirm-step dialog for the destructive delete. Shared between the category
 * summary card's ⋯ menu / Edit-sheet Status section and the income source
 * row's ⋯ menu (the `noun` swaps the copy). Owns its own action state so the
 * parent only manages open/close.
 */
export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  noun = "category",
  action,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  category: Pick<Category, "id" | "name">;
  noun?: "category" | "source";
  /**
   * Server action to call. Must accept `id` from the form and conform to
   * the structural `ActionState` shape ({ok, error}). The category-side
   * `deleteCategoryAction` redirects on success and never returns to the
   * client; the income-side `deleteIncomeSourceAction` returns normally
   * and the dialog's success effect closes + toasts.
   */
  action: DeleteAction;
  /** Fires once the delete-action returns success (after toast + close). */
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(action, CATEGORY_ACTION_INITIAL);

  // Success effect is a no-op for actions that `redirect()` — the component
  // unmounts before useEffect can run, and `state.ok` never increments
  // because the action never returns to the client. For non-redirecting
  // actions (income surface), this closes the dialog and emits a toast.
  useActionSuccessToast(
    state,
    () => `${noun === "source" ? "Income source" : "Category"} deleted`,
    () => {
      onOpenChange(false);
      onSuccess?.();
    },
  );

  const Noun = noun === "source" ? "source" : "category";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Delete {category.name}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Delete {category.name} permanently? This {Noun} has no
            transactions so it can be fully removed.
          </Dialog.Description>
          <form action={formAction} className="mt-5 flex justify-end gap-2">
            <input type="hidden" name="id" value={category.id} />
            <Dialog.Close className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Cancel
            </Dialog.Close>
            <FormSubmitButton
              label="Delete"
              pendingLabel="Deleting…"
              variant="destructive"
            />
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
