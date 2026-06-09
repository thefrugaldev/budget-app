"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteCategoryAction,
  deleteCategoryTargetAction,
  endCategoryAction,
  reopenCategoryAction,
  updateCategoryAction,
  upsertCategoryTargetAction,
} from "@/app/actions/categories";
import {
  CATEGORY_ACTION_INITIAL,
  type CategoryActionState,
} from "@/app/actions/category-state";
import { useNotify } from "@/components/notify";
import {
  currentMonthKey,
  fmt,
  monthLabel,
  nextMonth,
  resolveTargetForMonth,
  targetLabel,
} from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { Category, CategoryKind, CategoryTarget } from "@/types/budget";

const KIND_OPTIONS: { value: CategoryKind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "savings", label: "Savings" },
  { value: "income", label: "Income" },
];

/**
 * The replacement for the placeholder `<details>` "Threshold" disclosure on
 * the category detail page. Three sub-forms compose the panel:
 *
 *  1. Details — name, emoji, kind, activeFrom.
 *  2. Target  — monthly value with an "apply this month" toggle that switches
 *     the new target row's `effectiveFrom` between `currentMonth` (override)
 *     and `nextMonth(currentMonth)` (default, story 18).
 *  3. Lifecycle — End category (sets `activeUntil = currentMonth`) when the
 *     category has any history, vs. hard-delete (story 27) when it's empty.
 *
 * The Target history disclosure underneath shows the raw `CategoryTarget`
 * timeline with row-level edit/insert/delete (story 20). It's collapsed by
 * default — the inline target form covers the 90% case.
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
        <DetailsForm category={category} />
        <hr className="border-border" />
        <TargetForm
          category={category}
          currentTarget={currentTarget}
          thisMonth={thisMonth}
        />
        <hr className="border-border" />
        <LifecycleActions
          category={category}
          isEnded={isEnded}
          canHardDelete={canHardDelete}
          txCount={txCount}
          targetRowCount={myTargets.length}
        />
        <hr className="border-border" />
        <TargetHistorySection
          categoryId={category.id}
          targets={myTargets}
          kind={category.kind}
        />
      </div>
    </div>
  );
}

/**
 * Generic "fire-and-toast" effect. Same pattern as
 * `useSuccessEffect` in IncomeEditDialog, generalized to the category state
 * shape. The toast message is computed lazily so callers can close over fast-
 * changing form state without bookkeeping.
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

function DetailsForm({ category }: { category: Category }) {
  const [state, action] = useActionState(
    updateCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  useToastOnSuccess(state, () => "Category updated");

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
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton label="Save details" pendingLabel="Saving…" />
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
        <SubmitButton
          label="Save target"
          pendingLabel="Saving…"
          disabled={disabled}
        />
      </div>
    </form>
  );
}

function LifecycleActions({
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
  // Delete is special: the action calls `redirect("/")` on success, so this
  // hook's state only ever transitions on the *failure* branch. No toast on
  // success either — the redirect navigates away before a toast could land,
  // and the overview is the implicit confirmation surface.
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
            <SubmitButton
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
          <SubmitButton
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
            <SubmitButton
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

function TargetHistorySection({
  categoryId,
  targets,
  kind,
}: {
  categoryId: string;
  targets: CategoryTarget[];
  kind: CategoryKind;
}) {
  const [showAddRow, setShowAddRow] = useState(false);
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        View {targetLabel(kind).toLowerCase()} history
        <span className="ml-1 font-normal normal-case text-muted-foreground">
          ({targets.length} row{targets.length === 1 ? "" : "s"})
        </span>
      </summary>
      <div className="mt-3 space-y-2">
        {targets.map((row) => (
          <TargetRowForm
            key={`${row.categoryId}:${row.effectiveFrom}`}
            row={row}
            canDelete={targets.length > 1}
          />
        ))}
        {showAddRow ? (
          <NewTargetRowForm
            categoryId={categoryId}
            onDone={() => setShowAddRow(false)}
            onCancel={() => setShowAddRow(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowAddRow(true)}
            className="w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            + Insert target row
          </button>
        )}
      </div>
    </details>
  );
}

function TargetRowForm({
  row,
  canDelete,
}: {
  row: CategoryTarget;
  canDelete: boolean;
}) {
  const [monthly, setMonthly] = useState(row.monthly.toString());

  const [updateState, updateAction] = useActionState(
    upsertCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  useToastOnSuccess(
    updateState,
    () => `Target updated for ${monthLabel(row.effectiveFrom)}`,
  );
  useToastOnSuccess(
    deleteState,
    () => `Target row removed (${monthLabel(row.effectiveFrom)})`,
  );

  const error = updateState.error ?? deleteState.error;
  const parsed = Number(monthly);
  const unchanged = Number.isFinite(parsed) && parsed === row.monthly;

  return (
    <div className="rounded-md bg-background p-2 ring-1 ring-border">
      <form action={updateAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="categoryId" value={row.categoryId} />
        <input type="hidden" name="effectiveFrom" value={row.effectiveFrom} />
        <span className="min-w-[110px] text-xs font-medium">
          {monthLabel(row.effectiveFrom)}
        </span>
        <input
          name="monthly"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          required
          aria-label={`Monthly target effective ${row.effectiveFrom}`}
          className="w-28 rounded-md bg-background px-2 py-1 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
        />
        <SubmitButton
          label="Save"
          pendingLabel="…"
          disabled={unchanged}
          variant="compact"
        />
      </form>
      <form action={deleteAction} className="mt-1 flex justify-end">
        <input type="hidden" name="categoryId" value={row.categoryId} />
        <input type="hidden" name="effectiveFrom" value={row.effectiveFrom} />
        <SubmitButton
          label="Remove"
          pendingLabel="…"
          disabled={!canDelete}
          variant="ghost-destructive"
        />
      </form>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function NewTargetRowForm({
  categoryId,
  onDone,
  onCancel,
}: {
  categoryId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action] = useActionState(
    upsertCategoryTargetAction,
    CATEGORY_ACTION_INITIAL,
  );
  useToastOnSuccess(state, () => "Target row added", onDone);

  return (
    <form
      action={action}
      className="space-y-2 rounded-md bg-background p-2 ring-1 ring-border"
    >
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="effectiveFrom"
          type="month"
          required
          aria-label="Effective from"
          className="rounded-md bg-background px-2 py-1 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
        <input
          name="monthly"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          placeholder="$0/mo"
          required
          aria-label="Monthly target"
          className="w-28 rounded-md bg-background px-2 py-1 text-right text-sm tabular-nums ring-1 ring-border outline-none focus:ring-ring"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <SubmitButton label="Add row" pendingLabel="Adding…" variant="compact" />
      </div>
    </form>
  );
}

type SubmitVariant =
  | "primary"
  | "compact"
  | "ghost"
  | "destructive"
  | "ghost-destructive";

function SubmitButton({
  label,
  pendingLabel,
  disabled,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  variant?: SubmitVariant;
}) {
  const { pending } = useFormStatus();
  const base = "disabled:cursor-not-allowed disabled:opacity-50";
  const styles: Record<SubmitVariant, string> = {
    primary:
      "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80",
    compact:
      "rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/80",
    ghost:
      "rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
    destructive:
      "rounded-md bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive ring-1 ring-destructive/20 hover:bg-destructive/20",
    "ghost-destructive":
      "rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10",
  };
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(styles[variant], base)}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
