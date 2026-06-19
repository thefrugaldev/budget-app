"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState, useEffect, useRef } from "react";

import { endCategoryAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { useNotify } from "@/hooks/useNotify";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import {
  type ActionState,
  useActionSuccessToast,
} from "@/hooks/useActionSuccessToast";
import { currentMonthKey, monthLabel } from "@/lib/budget";
import type { Category } from "@/types/budget";

type LifecycleNoun = "category" | "source";

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
 * Confirm-step dialogs for the destructive lifecycle actions. Shared between
 * the category summary card's ⋯ menu and the Edit-sheet Status section, plus
 * the income source row's ⋯ menu. Each dialog owns its own action state so
 * the parent only manages open/close.
 *
 * The End dialog accepts a `noun` ("category" | "source") so the same
 * surface can serve income-source ends without re-implementing the dialog —
 * the underlying action (`endCategoryAction`) is identical.
 */

export function EndCategoryDialog({
  open,
  onOpenChange,
  category,
  noun = "category",
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** The end dialog only needs the id (for the action) and name (for copy). */
  category: Pick<Category, "id" | "name">;
  noun?: LifecycleNoun;
  /** Fires once the end-action succeeds, after the success toast. */
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(
    endCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  const notify = useNotify();
  const lastSeen = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastSeen.current && !state.error) {
      lastSeen.current = state.ok;
      notify.success(
        `${category.name} ended after ${monthLabel(currentMonthKey())}`,
      );
      onOpenChange(false);
      onSuccess?.();
    }
  }, [state, notify, category.name, onOpenChange, onSuccess]);

  const Noun = noun === "source" ? "source" : "category";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            End {category.name}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            End {category.name} effective this month? The {Noun} will move out
            of the current-month overview but its transactions and history
            remain. You can reopen later.
          </Dialog.Description>
          <form action={formAction} className="mt-5 flex justify-end gap-2">
            <input type="hidden" name="id" value={category.id} />
            <Dialog.Close className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Cancel
            </Dialog.Close>
            <FormSubmitButton
              label={`End ${Noun}`}
              pendingLabel="Ending…"
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
  noun?: LifecycleNoun;
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
