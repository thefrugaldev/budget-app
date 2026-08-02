import type { CategoryKind } from "./budget";

/**
 * Which way a category's activity has diverged from its Target, and therefore
 * which way the proposal moves it. `raise` = activity has sat sustainably above
 * the cap (propose a higher one); `lower` = sustainably below it (propose a
 * tighter one). Carried as a word so the direction never rests on color alone
 * (the accessibility baseline) and reads correctly for a cap — a raise vs a
 * lower — on both surfaces.
 */
export type TargetSuggestionDirection = "raise" | "lower";

/**
 * A **Target suggestion** (see CONTEXT.md): a system-detected proposal to change
 * a category's Target, derived from a sustained divergence between recent
 * activity and the Target in effect. Computed on read by
 * `selectTargetSuggestions` and never persisted (ADR 0006).
 *
 * The type is kind-aware so savings goals and income baselines can be enabled
 * later without reshaping consumers, but v1 only ever emits `expense`
 * suggestions.
 */
export type TargetSuggestion = {
  categoryId: string;
  kind: CategoryKind;
  direction: TargetSuggestionDirection;
  /** The Target in effect across the evidence window — the value being questioned. */
  currentTarget: number;
  /** The proposal: the window median rounded up to a friendly increment (story 4). */
  proposedTarget: number;
  /** The window's median monthly total — the typical figure the proposal derives from. */
  median: number;
  /**
   * Absolute monthly dollar distance between the proposal and the current
   * Target (`|proposedTarget − currentTarget|`). Drives Pulse's
   * largest-impact-first ranking.
   */
  impact: number;
};

/**
 * The persisted memory that a suggestion was **dismissed** — one row per
 * category (household-scoped). Lets the detector honor a snooze and re-surface
 * only when the picture materially changes: the observed level and the Target
 * it was measured against are captured so a later, larger divergence (or a
 * direction flip, or a Target change) can override the snooze rather than being
 * silenced by an old "no". This is the only new persisted state in the feature.
 */
export type TargetSuggestionDismissal = {
  categoryId: string;
  /** The window median observed when the suggestion was dismissed. */
  dismissedMedian: number;
  /** The Target the dismissed suggestion was measured against. */
  dismissedAgainstTarget: number;
  /** ISO timestamp of the dismissal — the snooze clock the detector reads against `now`. */
  dismissedAt: string;
};
