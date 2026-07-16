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
};

/**
 * The selected exception rows plus how many more were dropped by the display
 * cap — so the module can say "+N more" rather than silently truncating (story
 * 19).
 */
export type AttentionResult = {
  rows: AttentionRow[];
  hiddenCount: number;
};
