"use client";

import { useActionState } from "react";

import { reopenCategoryAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { EndedBadge } from "@/components/budget/category/EndedBadge";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import type { Category } from "@/types/budget";

/**
 * One ended-category row in Settings → Categories (#81 stories 7/8): the
 * category identity, its `EndedBadge`, and a Reopen control. Reopen reuses the
 * existing {@link reopenCategoryAction} — which clears `activeUntil`, no new
 * lifecycle concept — so on success the row drops out once `/settings`
 * revalidates, and a toast confirms it. The list only ever hands this row an
 * ended category, so `activeUntil` is present.
 */
export function EndedCategoryRow({ category }: { category: Category }) {
  const [state, action] = useActionState(
    reopenCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  useActionSuccessToast(state, () => `${category.name} reopened`);

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 ring-1 ring-border">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="text-lg">
          {category.emoji}
        </span>
        <span className="truncate font-medium">{category.name}</span>
        <EndedBadge ym={category.activeUntil!} className="shrink-0" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {state.error ? (
          <span role="alert" className="text-xs text-destructive">
            {state.error}
          </span>
        ) : null}
        <form action={action}>
          <input type="hidden" name="id" value={category.id} />
          <FormSubmitButton
            label="Reopen"
            pendingLabel="Reopening…"
            variant="ghost"
          />
        </form>
      </div>
    </li>
  );
}
