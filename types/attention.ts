import type { Category } from "./budget";
import type { ThresholdDescriptor } from "./threshold";

/**
 * Why a category surfaced in Pulse's "Needs attention" module (issue #166
 * story 18). Expenses raise `over-cap`; savings raise the goal-progress
 * exceptions (a net withdrawal, an untouched goal, being behind, or a met
 * goal). Income is out of scope for the module. Ordered here by severity —
 * see `ATTENTION_SEVERITY` in `lib/budget/attention.ts`.
 */
export type AttentionReason =
  | "over-cap"
  | "withdrawn"
  | "not-started"
  | "behind"
  | "goal-met";

/** One exception row for the "Needs attention" module. */
export type AttentionRow = {
  category: Category;
  reason: AttentionReason;
  /** From `thresholdDescriptor` — carries the text label + tone (never color alone). */
  descriptor: ThresholdDescriptor;
  /** Signed in-range total and summed target, straight from the aggregate. */
  total: number;
  denominator: number;
  /**
   * The magnitude the row is "off" by, in dollars: an expense's overage
   * (`total − cap`), a savings shortfall (the amount left to fund to reach
   * pace or goal), or a withdrawal's size (`|total|`). Zero for a met goal.
   */
  gap: number;
  /**
   * Short imperative for the gap ("Over by $20", "Fund $1,500 to catch up") so
   * a glance says the next step, not just the state (#178 story 7). Empty for a
   * met goal (nothing to act on). Preformatted here so the module renders it
   * verbatim — no re-derivation in the component.
   */
  action: string;
};

/**
 * A savings goal that is unfunded but not yet late — rendered as one calm,
 * grouped note in the module rather than an exception row (#178 story 4). Only
 * produced for the in-progress current month, before the pending→behind
 * threshold; a closed window's $0 is genuinely missed and stays a row.
 */
export type PendingRow = {
  category: Category;
  /** The outstanding goal amount (the summed target). */
  goal: number;
};

/**
 * When the selected range *is* the in-progress current month, the classifier
 * softens a not-yet-funded savings goal (pending early, behind pace once late)
 * instead of flagging $0 as missed. Absent for a closed window (a past month or
 * a multi-month span), where $0 saved is genuinely missed and stands (#178).
 */
export type AttentionPace = {
  /** Fraction of the current month elapsed, in (0, 1] — see `monthProgress`. */
  monthProgress: number;
};

/**
 * The selected exception rows plus how many more were dropped by the display
 * cap — so the module can say "+N more" rather than silently truncating (story
 * 19) — the calm pending group, and the "N of N on track" affirmation counts.
 */
export type AttentionResult = {
  rows: AttentionRow[];
  hiddenCount: number;
  /** Unfunded-but-not-late savings goals, shown as one grouped note (#178 story 4). */
  pending: PendingRow[];
  /** Categories judged this range (a cap/goal applied) — the denominator of "N of N on track". */
  evaluatedCount: number;
  /** Judged categories that are on track (not a problem, not pending) — the numerator. */
  onTrackCount: number;
};
