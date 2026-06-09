"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  deleteCategoryAction,
  endCategoryAction,
  reopenCategoryAction,
} from "@/app/actions/categories";
import {
  CATEGORY_ACTION_INITIAL,
  type CategoryActionState,
} from "@/app/actions/category-state";
import { useNotify } from "@/components/notify";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { currentMonthKey, monthLabel } from "@/lib/budget";
import type { Category } from "@/types/budget";

function useToastOnSuccess(
  state: CategoryActionState,
  computeMessage: () => string,
  onSuccess?: () => void,
) {
  const notify = useNotify();
  const lastSeen = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastSeen.current && !state.error) {
      lastSeen.current = state.ok;
      notify.success(computeMessage());
      onSuccess?.();
    }
  }, [state, onSuccess, notify, computeMessage]);
}

/**
 * Lifecycle controls for the category edit panel: End / Reopen / Delete.
 *
 *  - **Delete** is the only path when the category has no transactions and at
 *    most one target row. The server action calls `redirect("/")` on success
 *    so the still-mounted detail route doesn't briefly 404 between the
 *    deletion and the client redirect; no success toast is fired because
 *    the redirect navigates away before one could land.
 *  - **End** sets `activeUntil = currentMonth`. Visible whenever there's
 *    anything preventing hard-delete and the category isn't already ended.
 *  - **Reopen** clears `activeUntil`. Visible only when the category is
 *    currently ended.
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
  const [endState, endAction] = useActionState(
    endCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  const [reopenState, reopenAction] = useActionState(
    reopenCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );

  useToastOnSuccess(
    endState,
    () => `${category.name} ended after ${monthLabel(currentMonthKey())}`,
  );
  useToastOnSuccess(reopenState, () => `${category.name} reopened`);

  const error = endState.error ?? reopenState.error ?? deleteState.error;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Status
      </p>
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

      {canHardDelete ? (
        <form action={deleteAction}>
          <input type="hidden" name="id" value={category.id} />
          <FormSubmitButton
            label="Delete category"
            pendingLabel="Deleting…"
            variant="destructive"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Only available because this category has no transactions or
            historical target changes.
          </p>
        </form>
      ) : (
        !isEnded && (
          <form action={endAction}>
            <input type="hidden" name="id" value={category.id} />
            <FormSubmitButton
              label="End category"
              pendingLabel="Ending…"
              variant="destructive"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {txCount > 0
                ? `${txCount} transaction${txCount === 1 ? "" : "s"} prevent hard delete — end to retire while preserving history.`
                : `${targetRowCount} target rows prevent hard delete — end to retire while preserving history.`}
            </p>
          </form>
        )
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
