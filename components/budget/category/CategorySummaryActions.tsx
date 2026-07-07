"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, Pencil } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  deleteCategoryAction,
  reopenCategoryAction,
} from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { DeleteCategoryDialog } from "@/components/budget/category/DeleteCategoryDialog";
import { EndCategoryDialog } from "@/components/budget/category/EndCategoryDialog";
import { useCanEdit } from "@/hooks/useCanEdit";
import { useNotify } from "@/hooks/useNotify";
import type { Category } from "@/types/budget";

/**
 * Summary-card affordances: an Edit pencil (no-op unless `onEdit` is wired by
 * a parent) and a ⋯ overflow exposing category lifecycle actions:
 *
 *  - End category — opens a confirm dialog (destructive).
 *  - Reopen category — fires directly, no confirm (the reverse of End is
 *    recoverable). Replaces End in the menu when the category is ended.
 *  - Delete category — opens a confirm dialog; gated on `txCount === 0 &&
 *    targetRowCount <= 1`, matching the server-side rule.
 *
 * Auto-hides the overflow when no item would be visible.
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
  const canEdit = useCanEdit();
  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Reopen is the inverse of End and is fully recoverable, so it skips the
  // confirm dialog and fires straight from the menu item via React 19's
  // useActionState — toasting success/error rather than rendering a state
  // panel, since there's no dialog body to host one.
  const [reopenState, reopenAction] = useActionState(
    reopenCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  const notify = useNotify();
  const lastReopen = useRef<{ ok: number; error: string | null }>({
    ok: reopenState.ok,
    error: null,
  });
  useEffect(() => {
    const seen = lastReopen.current;
    if (reopenState.ok > seen.ok) {
      seen.ok = reopenState.ok;
      seen.error = null;
      notify.success(`${category.name} reopened`);
    } else if (reopenState.error && reopenState.error !== seen.error) {
      seen.error = reopenState.error;
      notify.error("Could not reopen", reopenState.error);
    }
  }, [reopenState, notify, category.name]);

  // Viewers see the card read-only — no edit pencil, no lifecycle overflow
  // (#111 story 9). All hooks run first so their order is stable across renders.
  if (!canEdit) return null;

  const isEnded = Boolean(category.activeUntil);
  const showEnd = !isEnded;
  const showReopen = isEnded;
  const showDelete = txCount === 0 && targetRowCount <= 1;
  const showOverflow = showEnd || showReopen || showDelete;

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
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-destructive outline-none data-[highlighted]:bg-destructive/10"
                  >
                    End category
                  </Menu.Item>
                )}
                {showReopen && (
                  <Menu.Item
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("id", category.id);
                      reopenAction(fd);
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
                  >
                    Reopen category
                  </Menu.Item>
                )}
                {showDelete && (
                  <Menu.Item
                    onClick={() => setDeleteOpen(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-destructive outline-none data-[highlighted]:bg-destructive/10"
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
        action={deleteCategoryAction}
      />
    </div>
  );
}
