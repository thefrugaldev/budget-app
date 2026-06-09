"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  updateCategoryAction,
  upsertCategoryTargetAction,
} from "@/app/actions/categories";
import {
  CATEGORY_ACTION_INITIAL,
  type CategoryActionState,
} from "@/app/actions/category-state";
import { CategoryLifecycleActions } from "@/components/budget/CategoryLifecycleActions";
import { CategoryTargetHistory } from "@/components/budget/CategoryTargetHistory";
import { useNotify } from "@/components/notify";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import {
  currentMonthKey,
  fmt,
  monthLabel,
  nextMonth,
  resolveTargetForMonth,
  targetLabel,
} from "@/lib/budget";
import type { Category, CategoryKind, CategoryTarget } from "@/types/budget";

// `as const satisfies Record<CategoryKind, string>` makes a future
// `CategoryKind` addition a compile error here rather than a silent
// select-option omission at runtime.
const KIND_LABELS = {
  expense: "Expense",
  savings: "Savings",
  income: "Income",
} as const satisfies Record<CategoryKind, string>;
const KIND_OPTIONS = (Object.keys(KIND_LABELS) as readonly CategoryKind[]).map(
  (value) => ({ value, label: KIND_LABELS[value] }),
);

/**
 * The replacement for the placeholder `<details>` "Threshold" disclosure on
 * the category detail page. Four sub-sections compose the panel:
 *
 *  1. Details — name, emoji, kind (locked when the category has transactions),
 *     and active range (`activeFrom` + optional `activeUntil`).
 *  2. Target — monthly value with an "apply this month" toggle that switches
 *     the new target row's `effectiveFrom` between `currentMonth` (override)
 *     and `nextMonth(currentMonth)` (default, story 18).
 *  3. Lifecycle — End category (sets `activeUntil = currentMonth`) when the
 *     category has any history, vs. hard-delete (story 27) when it's empty,
 *     plus Reopen when the category is already ended. Implemented in
 *     `CategoryLifecycleActions` so the redirect-on-delete flow is colocated
 *     with the other lifecycle controls.
 *  4. Target history — the timeline of `CategoryTarget` rows with row-level
 *     edit / insert / delete (story 20). Implemented in `CategoryTargetHistory`.
 */
export function CategoryEditPanel({
  category,
  targets,
  txCount,
  now,
}: {
  category: Category;
  /** All target rows; this panel filters to `category.id` itself. */
  targets: CategoryTarget[];
  /**
   * Live count of this category's transactions — caller computes off the
   * same `visibleTxns` array used by the rest of the body so the Delete
   * affordance becomes available the moment the last row is optimistically
   * deleted.
   */
  txCount: number;
  now: Date;
}) {
  const thisMonth = currentMonthKey(now);
  const myTargets = targets
    .filter((t) => t.categoryId === category.id)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const currentTarget = resolveTargetForMonth(category.id, thisMonth, targets);
  const canHardDelete = txCount === 0 && myTargets.length <= 1;
  const isEnded = category.activeUntil !== undefined;

  return (
    <div className="rounded-2xl bg-card p-4 text-sm ring-1 ring-border">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Edit category
      </h2>
      <div className="space-y-4">
        <DetailsForm category={category} txCount={txCount} />
        <hr className="border-border" />
        <TargetForm
          category={category}
          currentTarget={currentTarget}
          thisMonth={thisMonth}
        />
        <hr className="border-border" />
        <CategoryLifecycleActions
          category={category}
          isEnded={isEnded}
          canHardDelete={canHardDelete}
          txCount={txCount}
          targetRowCount={myTargets.length}
        />
        <hr className="border-border" />
        <CategoryTargetHistory
          categoryId={category.id}
          targets={myTargets}
          kind={category.kind}
        />
      </div>
    </div>
  );
}

/**
 * "Fire-and-toast" effect with lazy message computation. Same pattern as
 * IncomeEditDialog's `useSuccessEffect`, scoped to the category state shape.
 * The message is computed inside the success branch so it picks up the
 * latest form state at commit time.
 */
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

function DetailsForm({
  category,
  txCount,
}: {
  category: Category;
  txCount: number;
}) {
  const [state, action] = useActionState(
    updateCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  useToastOnSuccess(state, () => "Category updated");

  // Changing kind on a category with transactions silently re-interprets the
  // data — every row flips sign vocabulary, the savings rate is computed
  // against a different bucket, etc. Lock the picker as soon as there's any
  // history; the server action enforces the same rule (defense-in-depth).
  const kindLocked = txCount > 0;

  // Opt-in active-until: a `<input type="month">` with no value renders an
  // odd "—— ——" placeholder and primes the user to click into a control they
  // probably didn't want. Hide it behind a "Set end date" button instead.
  // Removing the input from the DOM submits no `activeUntil` field, which
  // the server action interprets as clearActiveUntil — same outcome as
  // submitting an empty value, but without the visual noise.
  const [showEndDate, setShowEndDate] = useState(
    category.activeUntil !== undefined,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={category.id} />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Details
      </p>
      <div className="grid grid-cols-[64px_1fr] gap-2">
        <input
          name="emoji"
          defaultValue={category.emoji}
          maxLength={4}
          aria-label="Emoji"
          className="rounded-md bg-background px-2 py-1.5 text-center text-lg ring-1 ring-border outline-none focus:ring-ring"
        />
        <input
          name="name"
          defaultValue={category.name}
          required
          aria-label="Name"
          className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </div>
      {kindLocked ? (
        // Disabled <select> elements don't participate in form submission,
        // so we'd silently drop the kind value on every Details save and
        // the action would throw "kind is required". Render the picker as
        // a read-only summary line with a hidden input carrying the value
        // instead — also a cleaner visual than a permanently-disabled
        // dropdown.
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">
            Kind
          </span>
          <p className="text-sm">{KIND_LABELS[category.kind]}</p>
          <span className="block text-[11px] text-muted-foreground">
            Locked: {txCount} transaction{txCount === 1 ? "" : "s"} would be
            re-interpreted by a kind change. Delete or move them first.
          </span>
          <input type="hidden" name="kind" value={category.kind} />
        </div>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Kind</span>
          <select
            name="kind"
            defaultValue={category.kind}
            className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Active from
        </span>
        <input
          name="activeFrom"
          type="month"
          defaultValue={category.activeFrom}
          required
          className="w-full rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </label>
      {showEndDate ? (
        <div className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">
            Active until
          </span>
          <div className="flex items-center gap-2">
            <input
              name="activeUntil"
              type="month"
              defaultValue={category.activeUntil ?? ""}
              required
              className="flex-1 rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowEndDate(false)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Saving with an end date set retires the category from the
            overview after that month. Clear to leave open-ended.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowEndDate(true)}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          + Set end date
        </button>
      )}
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <FormSubmitButton label="Save details" pendingLabel="Saving…" />
      </div>
    </form>
  );
}

function TargetForm({
  category,
  currentTarget,
  thisMonth,
}: {
  category: Category;
  currentTarget: number;
  thisMonth: string;
}) {
  const [monthlyInput, setMonthlyInput] = useState(currentTarget.toString());
  const [applyThisMonth, setApplyThisMonth] = useState(false);

  const [state, action] = useActionState(
    upsertCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  useToastOnSuccess(state, () =>
    `${targetLabel(category.kind)} updated · effective ${monthLabel(
      applyThisMonth ? thisMonth : nextMonth(thisMonth),
    )}`,
  );

  const parsed = Number(monthlyInput);
  const monthlyUnchanged =
    Number.isFinite(parsed) && parsed === currentTarget;
  const disabled = monthlyUnchanged && !applyThisMonth;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="categoryId" value={category.id} />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {targetLabel(category.kind)}
      </p>
      <p className="text-xs text-muted-foreground">
        Current: {fmt(currentTarget)}/mo. New baselines apply from{" "}
        {monthLabel(nextMonth(thisMonth))} unless you override.
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          Monthly
        </span>
        <input
          name="monthly"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={monthlyInput}
          onChange={(e) => setMonthlyInput(e.target.value)}
          required
          className="w-full rounded-md bg-background px-2 py-1.5 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="applyThisMonth"
          checked={applyThisMonth}
          onChange={(e) => setApplyThisMonth(e.target.checked)}
          className="size-3.5 accent-foreground"
        />
        Apply this month ({monthLabel(thisMonth)})
      </label>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <FormSubmitButton
          label="Save target"
          pendingLabel="Saving…"
          disabled={disabled}
        />
      </div>
    </form>
  );
}
