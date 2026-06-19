import type { Category, CategoryKind } from "@/types/budget";

export type ThresholdState = "under" | "near" | "at" | "over";

/**
 * Expense thresholds count toward the cap (over = bad). Savings and income
 * thresholds count toward the goal/baseline (over = good). The state
 * vocabulary is shared but the meaning of each state depends on `kind` —
 * pair this with `thresholdColor()` to translate to UI colors.
 */
export function thresholdFor(
  kind: CategoryKind,
  target: number,
  amount: number,
): ThresholdState {
  const pct = target === 0 ? 0 : amount / target;
  if (kind === "expense") {
    if (pct < 0.7) return "under";
    if (pct < 0.9) return "near";
    if (pct <= 1.0) return "at";
    return "over";
  }
  if (pct >= 1.0) return "over";
  if (pct >= 0.9) return "at";
  if (pct >= 0.7) return "near";
  return "under";
}

export type ThresholdPalette = {
  text: string;
  bar: string;
};

const SIGNAL = {
  good: { text: "text-signal-good-foreground", bar: "bg-signal-good" },
  warn: { text: "text-signal-warn-foreground", bar: "bg-signal-warn" },
  bad: { text: "text-signal-bad-foreground", bar: "bg-signal-bad" },
} satisfies Record<string, ThresholdPalette>;

/**
 * Render-layer mapping from (kind, target, amount) to one of three signals.
 *
 *   expense   → good when under cap, warn when ≥90% of cap, bad when exceeded.
 *   non-expense (savings/income) → good for any net-positive contribution
 *     regardless of how far along; bad only when the period nets negative
 *     (withdrawal / reversal). A "savings at 50% of goal" is progress, not
 *     a warning — separate from the four-state `ThresholdState` which keeps
 *     under/near/at/over for headline copy.
 */
export function thresholdColor(
  kind: Category["kind"],
  target: number,
  amount: number,
): ThresholdPalette {
  if (kind !== "expense") {
    return amount < 0 ? SIGNAL.bad : SIGNAL.good;
  }
  const state = thresholdFor(kind, target, amount);
  if (state === "over") return SIGNAL.bad;
  if (state === "at") return SIGNAL.warn;
  return SIGNAL.good;
}
