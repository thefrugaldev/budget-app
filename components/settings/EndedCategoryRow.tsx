"use client";

import { useActionState } from "react";

import { reopenCategoryAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { CategoryIcon } from "@/components/budget/category/CategoryIcon";
import { EndedBadge } from "@/components/budget/category/EndedBadge";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { useActionSuccessToast } from "@/hooks/useActionSuccessToast";
import { useCanEdit } from "@/hooks/useCanEdit";
import type { Category } from "@/types/budget";

/**
 * One ended-category row in Settings → Categories (#81 stories 7/8): the
 * category identity, its `EndedBadge`, and a Reopen control. Reopen reuses the
 * existing {@link reopenCategoryAction} — which clears `activeUntil`, no new
 * lifecycle concept — so on success the row drops out once `/settings`
 * revalidates, and a toast confirms it. The prop type carries `activeUntil`
 * as required — the caller filters to ended categories via `isCategoryEnded`
 * (a type guard), so no non-null assertion is needed here.
 */
export function EndedCategoryRow({
  category,
}: {
  category: Category & { activeUntil: string };
}) {
  const [state, action] = useActionState(
    reopenCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  useActionSuccessToast(state, () => `${category.name} reopened`);
  const canEdit = useCanEdit();

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-background px-3 py-2 ring-1 ring-border">
      <div className="flex min-w-0 items-center gap-2">
        <CategoryIcon
          category={category}
          className="size-4 rounded-none bg-transparent text-current"
          iconClassName="size-4"
        />
        <span className="truncate font-medium">{category.name}</span>
        <EndedBadge ym={category.activeUntil} className="shrink-0" />
      </div>
      {/* Viewers can review which categories are ended, but Reopen is an editor
          action — hidden for them (#111 story 9). */}
      {canEdit && (
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
      )}
    </li>
  );
}
