"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import { useActionState, useState } from "react";

import {
  deleteCategoryAction,
  reopenCategoryAction,
} from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { DeleteCategoryDialog } from "@/components/budget/category/DeleteCategoryDialog";
import { EndCategoryDialog } from "@/components/budget/category/EndCategoryDialog";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useCanEdit } from "@/hooks/useCanEdit";
import { monthLabel } from "@/lib/budget";
import type { Category } from "@/types/budget";

/**
 * Status section of the category Edit sheet. Reads the active-range state,
 * surfaces a Reopen button when the category is ended (recoverable, no
 * confirm), and exposes the destructive lifecycle actions (End / Delete)
 * behind a ⋯ overflow with a confirm step that names the consequence.
 *
 * Mirrors the pattern on the summary card's `CategorySummaryActions` — the
 * two surfaces share the same confirm dialogs (`EndCategoryDialog` /
 * `DeleteCategoryDialog`).
 */
export function CategoryLifecycleActions({
  category,
  isEnded,
  canHardDelete,
  txCount,
  targetRowCount,
}: {
  category: Category;
  isEnded: boolean;
  canHardDelete: boolean;
  txCount: number;
  targetRowCount: number;
}) {
  const canEdit = useCanEdit();
  const [reopenState, reopenAction] = useActionState(
    reopenCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  useActionSuccessToast(reopenState, () => `${category.name} reopened`);

  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // The Edit sheet is unreachable for viewers (the pencil is hidden), but guard
  // the status/lifecycle actions here too so they never render (#111 story 9).
  if (!canEdit) return null;

  const showEnd = !isEnded;
  const showDelete = canHardDelete;
  const showOverflow = showEnd || showDelete;

  const helperCopy = canHardDelete
    ? "No transactions or historical target changes — Delete fully removes this category."
    : txCount > 0
      ? `${txCount} transaction${txCount === 1 ? "" : "s"} prevent hard delete — end to retire while preserving history.`
      : `${targetRowCount} target rows prevent hard delete — end to retire while preserving history.`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </p>
        {showOverflow && (
          <Menu.Root>
            <Menu.Trigger
              aria-label="Lifecycle actions"
              className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner
                sideOffset={4}
                align="end"
                className="z-50 outline-none"
              >
                <Menu.Popup className="min-w-44 rounded-xl bg-card p-1 text-sm shadow-xl ring-1 ring-border outline-none">
                  {showEnd && (
                    <Menu.Item
                      onClick={() => setEndOpen(true)}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-destructive outline-none data-[highlighted]:bg-destructive/10"
                    >
                      End category
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
      </div>

      {isEnded ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs">
          <span>
            Ended after{" "}
            <span className="font-medium">
              {monthLabel(category.activeUntil!)}
            </span>
          </span>
          <form action={reopenAction}>
            <input type="hidden" name="id" value={category.id} />
            <FormSubmitButton
              label="Reopen"
              pendingLabel="Reopening…"
              variant="ghost"
            />
          </form>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Active since {monthLabel(category.activeFrom)}.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">{helperCopy}</p>

      {reopenState.error && (
        <p role="alert" className="text-xs text-destructive">
          {reopenState.error}
        </p>
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
