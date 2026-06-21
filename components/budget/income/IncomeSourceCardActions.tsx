"use client";

import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { reopenCategoryAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import {
  cancelScheduledBaselineAction,
  deleteIncomeSourceAction,
} from "@/app/actions/income";
import { INCOME_ACTION_INITIAL } from "@/app/actions/income-state";
import { DeleteCategoryDialog } from "@/components/budget/category/DeleteCategoryDialog";
import { EndCategoryDialog } from "@/components/budget/category/EndCategoryDialog";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import type { Category, CategoryTarget } from "@/types/budget";

/**
 * Per-row lifecycle affordances for an income source on `/income`
 * (chunk 6 of #39). Renders:
 *
 *  - Leading `Reopen` button when the source is ended (story 9 — recovery
 *    is a single click without menu discovery).
 *  - ⋯ overflow menu with conditional items:
 *    - **End source** (active / scheduled-change rows) → confirm via the
 *      shared `EndCategoryDialog` (`noun="source"`).
 *    - **Cancel scheduled change** (rows with a future-effective target)
 *      → fires `cancelScheduledBaselineAction` directly, no confirm —
 *      mirrors the `Reopen` pattern (recoverable, fully reversible).
 *    - **Reopen source** (ended rows) → fires `reopenCategoryAction`
 *      directly. Duplicates the leading button for menu-consistency with
 *      the category surface (story 8).
 *    - **Delete source** (hard-delete eligible: zero transactions, at
 *      most one target row) → confirm via shared `DeleteCategoryDialog`
 *      with the income-specific `deleteIncomeSourceAction` (which stays
 *      on `/income` rather than redirecting, unlike the category-side
 *      action).
 *
 * Hard-delete eligibility is computed and gated client-side here as a UX
 * shortcut; `deleteIncomeSourceAction` enforces the same rule on the
 * server.
 */
export function IncomeSourceCardActions({
  source,
  isEnded,
  txCount,
  targetRowCount,
  scheduledTarget,
}: {
  source: Category;
  isEnded: boolean;
  txCount: number;
  targetRowCount: number;
  /** Soonest future-effective target, when one exists. */
  scheduledTarget?: CategoryTarget;
}) {
  const [endOpen, setEndOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [reopenState, reopenAction] = useActionState(
    reopenCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  useActionSuccessToast(reopenState, () => `${source.name} reopened`);

  const [cancelState, cancelAction] = useActionState(
    cancelScheduledBaselineAction,
    INCOME_ACTION_INITIAL,
  );
  useActionSuccessToast(cancelState, () => "Scheduled change cancelled");

  const showEnd = !isEnded;
  const showReopen = isEnded;
  const showCancel = Boolean(scheduledTarget) && !isEnded;
  const showDelete = txCount === 0 && targetRowCount <= 1;
  const showOverflow = showEnd || showReopen || showCancel || showDelete;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {showReopen && (
        <form action={reopenAction}>
          <input type="hidden" name="id" value={source.id} />
          <FormSubmitButton
            label="Reopen"
            pendingLabel="Reopening…"
            variant="compact"
          />
        </form>
      )}

      {showOverflow && (
        <Menu.Root>
          <Menu.Trigger
            aria-label={`Actions for ${source.name}`}
            className="cursor-pointer rounded-full p-1.5 text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-rose-700 outline-none data-[highlighted]:bg-rose-50 dark:text-rose-400 dark:data-[highlighted]:bg-rose-950"
                  >
                    End source
                  </Menu.Item>
                )}
                {showCancel && scheduledTarget && (
                  <Menu.Item
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("categoryId", source.id);
                      fd.set("effectiveFrom", scheduledTarget.effectiveFrom);
                      startTransition(() => cancelAction(fd));
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
                  >
                    Cancel scheduled change
                  </Menu.Item>
                )}
                {showReopen && (
                  <Menu.Item
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("id", source.id);
                      startTransition(() => reopenAction(fd));
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
                  >
                    Reopen source
                  </Menu.Item>
                )}
                {showDelete && (
                  <Menu.Item
                    onClick={() => setDeleteOpen(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-rose-700 outline-none data-[highlighted]:bg-rose-50 dark:text-rose-400 dark:data-[highlighted]:bg-rose-950"
                  >
                    Delete source
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
        category={{ id: source.id, name: source.name }}
        noun="source"
      />
      <DeleteCategoryDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        category={{ id: source.id, name: source.name }}
        noun="source"
        action={deleteIncomeSourceAction}
      />

      {reopenState.error && (
        <p role="alert" className="sr-only">
          Reopen failed: {reopenState.error}
        </p>
      )}
      {cancelState.error && (
        <p role="alert" className="sr-only">
          Cancel scheduled change failed: {cancelState.error}
        </p>
      )}
    </div>
  );
}
