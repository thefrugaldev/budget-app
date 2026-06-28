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

export type ThresholdTone = "good" | "warn" | "bad";

/**
 * Text-bearing, color-independent description of a category's threshold state.
 * `label` is a short word/abbreviation so colorblind users get the signal
 * without relying on the meter color, and `tone` mirrors {@link thresholdColor}
 * so the (optional) color reinforcement always agrees with the words.
 */
export type ThresholdDescriptor = {
  state: ThresholdState;
  label: string;
  tone: ThresholdTone;
};

// "over" means opposite things by kind, so the words diverge: a maxed expense
// is bad ("Over cap"), a maxed savings goal is good ("Goal met").
const EXPENSE_LABELS: Record<ThresholdState, string> = {
  under: "Under cap",
  near: "Near cap",
  at: "At cap",
  over: "Over cap",
};

const EXPENSE_TONES: Record<ThresholdState, ThresholdTone> = {
  under: "good",
  near: "good",
  at: "warn",
  over: "bad",
};

const GOAL_LABELS: Record<ThresholdState, string> = {
  under: "On track",
  near: "Near goal",
  at: "At goal",
  over: "Goal met",
};

/**
 * Render-layer descriptor mirroring {@link thresholdColor}'s meaning-flip:
 *
 *   expense → tone tracks cap pressure (good under, warn at cap, bad over).
 *   non-expense (savings/income) → any net contribution is progress (good);
 *     only a net withdrawal/reversal is bad, labelled "Withdrawn" since the
 *     four-state vocabulary has no word for going backwards.
 */
export function thresholdDescriptor(
  kind: Category["kind"],
  target: number,
  amount: number,
): ThresholdDescriptor {
  const state = thresholdFor(kind, target, amount);
  if (kind !== "expense") {
    if (amount < 0) return { state, label: "Withdrawn", tone: "bad" };
    return { state, label: GOAL_LABELS[state], tone: "good" };
  }
  return { state, label: EXPENSE_LABELS[state], tone: EXPENSE_TONES[state] };
}
