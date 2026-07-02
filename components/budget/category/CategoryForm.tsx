"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createCategoryAction } from "@/app/actions/categories";
import { CATEGORY_ACTION_INITIAL } from "@/app/actions/category-state";
import { AmountInput } from "@/components/budget/amount/AmountInput";
import { CategoryIconPicker } from "@/components/budget/category/CategoryIconPicker";
import { useNotify } from "@/hooks/useNotify";
import { FormSubmitButton } from "@/components/ui/FormSubmitButton";
import { MonthPickerField } from "@/components/ui/MonthPickerField";
import { currentMonthKey } from "@/lib/budget";
import { cn } from "@/lib/utils";
import type { CategoryKind } from "@/types/budget";

// `satisfies Record<CategoryKind, ...>` (vs. an explicit annotation) keeps the
// type narrow — each key keeps its literal value — while still forcing a
// compile error if a future `CategoryKind` lands without a matching entry.
const KIND_LABELS = {
  expense: "Expense",
  savings: "Savings",
  income: "Income",
} as const satisfies Record<CategoryKind, string>;

const KIND_HINTS = {
  expense: "Money flowing out — caps you don't want to exceed.",
  savings: "Buckets you're contributing to — goals you want to hit.",
  income: "Streams of money in — baselines you compare against.",
} as const satisfies Record<CategoryKind, string>;

const KIND_PLACEHOLDERS = {
  expense: { name: "Streaming", emoji: "📺" },
  savings: { name: "Vacation", emoji: "🌴" },
  income: { name: "Side gig", emoji: "💼" },
} as const satisfies Record<CategoryKind, { name: string; emoji: string }>;

export type CategoryFormProps = {
  /** When set, locks the kind picker and bakes the value into the submitted form. */
  presetKind?: CategoryKind;
  /** Restrict the picker to a subset of kinds (e.g. ["expense", "savings"]). */
  allowedKinds?: readonly CategoryKind[];
  onSuccess?: (id: string) => void;
  className?: string;
};

/**
 * Form for creating a new category. Three call sites:
 *
 *   - Inline `+ Add category` tiles in the Expenses and Savings sections of
 *     the Pulse page — `presetKind` is set, so the kind picker collapses to
 *     a single chip;
 *   - Floating `+` menu's `Add category` option — `allowedKinds` limits the
 *     picker to expense/savings (income has its own dedicated menu entry);
 *   - Category-detail-page sidebar's `Add another` shortcut (future), where
 *     no preset is given.
 *
 * Always writes both a new `Category` document and an initial `CategoryTarget`
 * row keyed at the chosen `activeFrom`.
 */
export function CategoryForm({
  presetKind,
  allowedKinds,
  onSuccess,
  className,
}: CategoryFormProps) {
  const [state, formAction] = useActionState(
    createCategoryAction,
    CATEGORY_ACTION_INITIAL,
  );
  const notify = useNotify();
  const lastOk = useRef(state.ok);
  useEffect(() => {
    if (state.ok > lastOk.current && !state.error && state.id) {
      lastOk.current = state.ok;
      notify.success("Category added");
      onSuccess?.(state.id);
    }
  }, [state, notify, onSuccess]);

  const pickerKinds: readonly CategoryKind[] = presetKind
    ? [presetKind]
    : (allowedKinds ?? (["expense", "savings", "income"] as const));
  const [kind, setKind] = useState<CategoryKind>(presetKind ?? pickerKinds[0]);
  const effectiveKind = presetKind ?? kind;
  const placeholders = KIND_PLACEHOLDERS[effectiveKind];
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string>(
    KIND_PLACEHOLDERS[presetKind ?? pickerKinds[0]].emoji,
  );
  const [activeFrom, setActiveFrom] = useState<string>(currentMonthKey());
  const [monthly, setMonthly] = useState("");

  return (
    <form action={formAction} className={cn("space-y-3", className)}>
      <input type="hidden" name="kind" value={effectiveKind} />

      {!presetKind && pickerKinds.length > 1 && (
        <div role="group" aria-label="Kind" className="space-y-1">
          <span className="block text-xs font-medium text-muted-foreground">
            Kind
          </span>
          <div className="inline-flex w-full rounded-md bg-muted p-0.5 text-xs ring-1 ring-border">
            {pickerKinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  "flex-1 rounded-[5px] px-2 py-1 font-medium transition-colors",
                  kind === k
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{KIND_HINTS[effectiveKind]}</p>
        </div>
      )}

      <div className="grid grid-cols-[64px_1fr] gap-2">
        <CategoryIconPicker
          value={emoji}
          onChange={setEmoji}
          nameHint={name}
          ariaLabel="Choose category icon"
        />
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholders.name}
          required
          aria-label="Name"
          className="rounded-md bg-background px-2 py-1.5 text-sm ring-1 ring-border outline-none focus:ring-ring"
        />
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          {effectiveKind === "expense"
            ? "Monthly cap"
            : effectiveKind === "savings"
              ? "Monthly goal"
              : "Monthly baseline"}
        </span>
        <AmountInput
          name="monthly"
          precision={effectiveKind === "income" ? "whole" : "cents"}
          variant="display"
          value={monthly}
          onChange={setMonthly}
          allowZero
          placeholder="$0/mo"
          ariaLabel={
            effectiveKind === "expense"
              ? "Monthly cap"
              : effectiveKind === "savings"
                ? "Monthly goal"
                : "Monthly baseline"
          }
        />
      </label>

      <div className="space-y-1">
        <span className="block text-xs font-medium text-muted-foreground">
          Active from
        </span>
        <MonthPickerField
          value={activeFrom}
          onChange={setActiveFrom}
          name="activeFrom"
          required
          ariaLabel="Active from"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <FormSubmitButton label="Add category" pendingLabel="Adding…" />
      </div>
    </form>
  );
}
