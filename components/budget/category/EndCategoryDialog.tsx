"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useActionState, useEffect, useRef } from "react";

import { endCategoryAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { DialogFooter, DialogFooterCancel } from "@/components/ui/DialogFooter";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useNotify } from "@/hooks/useNotify";
import { currentMonthKey, monthLabel } from "@/lib/budget";
import type { Category } from "@/types/budget";

/**
 * Confirm-step dialog for ending a category effective this month. Shared
 * between the category summary card's ⋯ menu, the Edit-sheet Status section,
 * and the income source row's ⋯ menu — the `noun` ("category" | "source")
 * swaps the copy so the same surface serves income-source ends without
 * re-implementing the dialog (the underlying `endCategoryAction` is identical).
 * Owns its own action state so the parent only manages open/close.
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
  noun?: "category" | "source";
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
          <form action={formAction}>
            <input type="hidden" name="id" value={category.id} />
            <DialogFooter className="mt-5">
              <DialogFooterCancel />
              <FormSubmitButton
                label={`End ${Noun}`}
                pendingLabel="Ending…"
                variant="destructive"
              />
            </DialogFooter>
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
