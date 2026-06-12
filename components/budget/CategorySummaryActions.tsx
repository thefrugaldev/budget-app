"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  deleteCategoryAction,
  endCategoryAction,
} from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { useNotify } from "@/components/notify";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { currentMonthKey, monthLabel } from "@/lib/budget";
import type { Category } from "@/types/budget";

/**
 * Summary-card affordances: an Edit pencil (no-op unless `onEdit` is wired by
 * a parent) and a ⋯ overflow exposing destructive lifecycle actions — End
 * category (when not already ended) and Delete category (when there are no
 * transactions and at most one target row). Each destructive item opens a
 * confirm dialog naming the consequence.
 *
 * Auto-hides the overflow when neither item would be visible (e.g. an ended
 * category that still has transactions or historical targets).
 */
export function CategorySummaryActions({
  category,
  txCount,
  targetRowCount,
  onEdit,
}: {
  category: Category;
  txCount: number;
  targetRowCount: number;
  onEdit?: () => void;
}) {
  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isEnded = Boolean(category.activeUntil);
  const showEnd = !isEnded;
  const showDelete = txCount === 0 && targetRowCount <= 1;
  const showOverflow = showEnd || showDelete;

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit category"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      {showOverflow && (
        <Menu.Root>
          <Menu.Trigger
            aria-label="Category actions"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={4} align="end" className="z-30 outline-none">
              <Menu.Popup className="min-w-44 rounded-xl bg-card p-1 text-sm shadow-xl ring-1 ring-border outline-none">
                {showEnd && (
                  <Menu.Item
                    onClick={() => setEndOpen(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-rose-700 outline-none data-[highlighted]:bg-rose-50 dark:text-rose-400 dark:data-[highlighted]:bg-rose-950"
                  >
                    End category
                  </Menu.Item>
                )}
                {showDelete && (
                  <Menu.Item
                    onClick={() => setDeleteOpen(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-rose-700 outline-none data-[highlighted]:bg-rose-50 dark:text-rose-400 dark:data-[highlighted]:bg-rose-950"
                  >
                    Delete category
                  </Menu.Item>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}

      <EndCategoryDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        category={category}
      />
      <DeleteCategoryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        category={category}
      />
    </div>
  );
}

function EndCategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  category: Category;
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
    }
  }, [state, notify, category.name, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            End {category.name}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            End {category.name} effective this month? The category will move
            out of the current-month overview but its transactions and history
            remain. You can reopen later.
          </Dialog.Description>
          <form action={formAction} className="mt-5 flex justify-end gap-2">
            <input type="hidden" name="id" value={category.id} />
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Cancel
            </Dialog.Close>
            <FormSubmitButton
              label="End category"
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

function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  category: Category;
}) {
  const [state, formAction] = useActionState(
    deleteCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  // `deleteCategoryAction` calls `redirect("/")` on success — the page
  // unmounts before any client effect could run, so no success toast or
  // explicit close is needed here.

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 transition-opacity" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border outline-none data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 transition-[opacity,transform]">
          <Dialog.Title className="font-heading text-lg font-semibold">
            Delete {category.name}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Delete {category.name} permanently? This category has no
            transactions so it can be fully removed.
          </Dialog.Description>
          <form action={formAction} className="mt-5 flex justify-end gap-2">
            <input type="hidden" name="id" value={category.id} />
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
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
