/**
 * Target-suggestion domain logic (#186, ADR 0006). The detector
 * (`selectTargetSuggestions`) is the intellectual core of the feature: given the
 * transactions and targets a page already holds, plus any recorded dismissals,
 * it derives — on read, never persisted — the small set of caps whose reality
 * has sustainably drifted from the plan. This file also owns the pure
 * proposed-value helper the detector uses to turn a typical month into a
 * friendly round number.
 */

import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import type {
  TargetSuggestion,
  TargetSuggestionDirection,
  TargetSuggestionDismissal,
} from "@/types/target-suggestion";

import { isCategoryActiveForMonth, resolveTargetForMonth } from "./aggregate";
import { currentMonthKey, shiftMonth } from "./range";

/** The evidence window: the last six **complete** months (the in-progress month excluded). */
const WINDOW_MONTHS = 6;
/**
 * How many of the six months must individually sit on the *same* side of the cap
 * for the drift to count as sustained. At 5/6 a single blowout (or a single dip)
 * month can never on its own reach quorum — this is the anti-spike guard.
 */
const PERSISTENCE_QUORUM = 5;
/**
 * Per-month neutral band around the cap (±5%): a month within it is "at cap" and
 * counts for neither side, so ordinary noise doesn't manufacture a trend.
 */
const DEAD_BAND = 0.05;
/** The window median must clear BOTH of these vs the cap for the drift to be worth acting on. */
const MAGNITUDE_PCT = 0.15;
const MAGNITUDE_ABS = 25;
/** How long a dismissal silences a still-firing suggestion before it may return. */
const SNOOZE_MONTHS = 3;

/**
 * The friendly rounding increment for a monthly figure of this magnitude. The
 * step widens with scale so the proposal is a clean round number whether it's a
 * $60 streaming bill or a $3,000 mortgage:
 *
 *   under $100 → $5 · under $250 → $10 · under $1,000 → $25 · $1,000+ → $50
 *
 * The band is chosen by the input figure (the median), not the rounded result.
 */
function incrementFor(value: number): number {
  if (value < 100) return 5;
  if (value < 250) return 10;
  if (value < 1000) return 25;
  return 50;
}

/**
 * Turn the evidence window's median monthly total into the proposed Target
 * shown in a suggestion (story 4): round **up** to the friendly increment for
 * its magnitude. Rounding up (rather than to-nearest) bakes a little headroom
 * into the proposal in both directions — a raised cap clears the typical month,
 * a lowered cap still leaves a touch of slack. The same rounding serves raise
 * and lower suggestions; direction is decided by the detector, not here.
 *
 * A figure already sitting on its increment is returned unchanged (a small
 * epsilon absorbs float error so `250` stays `250` rather than jumping to
 * `275`). A non-positive median has no sensible friendly cap, so it yields `0`;
 * the detector only calls this with a positive median.
 */
export function proposeTargetFromMedian(median: number): number {
  if (median <= 0) return 0;
  const step = incrementFor(median);
  return Math.ceil(median / step - 1e-9) * step;
}

/** Median of a non-empty list (mean of the two middles for an even count). */
function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** True once `now` is at least `SNOOZE_MONTHS` calendar months past the dismissal. */
function snoozeElapsed(dismissedAt: string, now: Date): boolean {
  const d = new Date(dismissedAt);
  const threshold = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth() + SNOOZE_MONTHS,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
  return now.getTime() >= threshold;
}

/**
 * Whether a recorded dismissal should keep a currently-firing suggestion quiet.
 * The suggestion returns (dismissal does NOT suppress) when the picture has
 * materially changed since the "no":
 *   - the cap has changed since the dismissal → the record is stale (story 8);
 *   - the divergence direction has flipped → a genuinely new regime (story 10);
 *   - the median has moved another 15%/$25 further in the same direction (story 10);
 *   - the 3-month snooze has elapsed and the trigger still fires (story 9).
 * Otherwise — still inside the snooze, nothing materially new — it stays quiet.
 */
function dismissalSuppresses(
  dismissal: TargetSuggestionDismissal,
  direction: TargetSuggestionDirection,
  currentTarget: number,
  median: number,
  now: Date,
): boolean {
  // Cap changed since the dismissal → the snapshot it captured is stale.
  if (currentTarget !== dismissal.dismissedAgainstTarget) return false;

  // Direction flip → re-surface immediately, without waiting out the snooze.
  const dismissedDirection: TargetSuggestionDirection =
    dismissal.dismissedMedian >= dismissal.dismissedAgainstTarget ? "raise" : "lower";
  if (dismissedDirection !== direction) return false;

  // Moved materially further in the same direction → re-surface immediately.
  const furtherShift =
    direction === "raise"
      ? median - dismissal.dismissedMedian
      : dismissal.dismissedMedian - median;
  const shiftThreshold = Math.max(
    MAGNITUDE_PCT * Math.abs(dismissal.dismissedMedian),
    MAGNITUDE_ABS,
  );
  if (furtherShift >= shiftThreshold) return false;

  // Snooze elapsed and (by virtue of reaching here) the trigger still fires.
  if (snoozeElapsed(dismissal.dismissedAt, now)) return false;

  return true;
}

/**
 * Detect the caps whose recent activity has sustainably diverged from the plan
 * and propose a trued-up value for each. Pure and derived-on-read (ADR 0006):
 * pass the same `categories`, `transactions`, and `targets` a page already
 * loads, plus the recorded `dismissals` and a fixed `now`; get back a list of
 * {@link TargetSuggestion} ranked by dollar impact (largest change first).
 *
 * A category earns a suggestion only when every gate holds:
 *   - **Eligible** — an `expense` category, currently active, with a cap > $0
 *     that has been stable for the whole six-month window (a cap changed inside
 *     the window — manually or via a prior accept — makes it go quiet, story 16;
 *     imported categories are eligible, story 18).
 *   - **Persistent** — at least five of the six complete months sit on the same
 *     side of the cap beyond a 5% dead-band, so one outlier month can't trigger
 *     it (story 3) and a lumpy category whose months scatter never reaches
 *     quorum (story 19).
 *   - **Material** — the window median differs from the cap by ≥15% and ≥$25.
 *   - **Not snoozed** — any dismissal for the category doesn't suppress it
 *     (see {@link dismissalSuppresses}).
 *
 * Kind-aware but expense-only in output for v1: savings goals and income
 * baselines are deliberately not emitted yet.
 */
export function selectTargetSuggestions(
  categories: Category[],
  transactions: Transaction[],
  targets: CategoryTarget[],
  dismissals: TargetSuggestionDismissal[],
  now: Date = new Date(),
): TargetSuggestion[] {
  const currentMonth = currentMonthKey(now);
  const lastFull = shiftMonth(currentMonth, -1);
  const windowStart = shiftMonth(lastFull, -(WINDOW_MONTHS - 1));
  const windowMonths: string[] = [];
  for (let i = 0; i < WINDOW_MONTHS; i++) windowMonths.push(shiftMonth(windowStart, i));

  const dismissalByCategory = new Map(dismissals.map((d) => [d.categoryId, d]));
  const suggestions: { suggestion: TargetSuggestion; name: string }[] = [];

  for (const category of categories) {
    // v1 emits expense caps only (kind-aware; savings/income deferred).
    if (category.kind !== "expense") continue;
    // Currently active — an ended category makes no noise (story 17).
    if (!isCategoryActiveForMonth(category, currentMonth)) continue;

    // Cap stability: no target row may take effect *after* the window start, so
    // the cap has been the same value for all six months. This disqualifies a
    // mid-window change and a just-accepted (future-dated) one alike (story 16).
    const stable = !targets.some(
      (t) => t.categoryId === category.id && t.effectiveFrom > windowStart,
    );
    if (!stable) continue;

    const currentTarget = resolveTargetForMonth(category.id, lastFull, targets);
    if (currentTarget <= 0) continue; // unbudgeted — nothing to drift from (story 17)

    // Per-month totals across the window, and the same-side persistence vote.
    const totals = windowMonths.map((ym) => {
      let total = 0;
      for (const t of transactions) {
        if (t.categoryId === category.id && t.date.startsWith(ym)) total += t.amount;
      }
      return total;
    });
    const overBand = currentTarget * (1 + DEAD_BAND);
    const underBand = currentTarget * (1 - DEAD_BAND);
    const overCount = totals.filter((t) => t > overBand).length;
    const underCount = totals.filter((t) => t < underBand).length;

    let direction: TargetSuggestionDirection;
    if (overCount >= PERSISTENCE_QUORUM) direction = "raise";
    else if (underCount >= PERSISTENCE_QUORUM) direction = "lower";
    else continue; // no sustained same-side drift (spike/lumpy) — stories 3, 19

    // Magnitude: the typical (median) month must clear both thresholds vs the cap.
    const median = medianOf(totals);
    const gap = Math.abs(median - currentTarget);
    if (gap < MAGNITUDE_PCT * currentTarget || gap < MAGNITUDE_ABS) continue;

    const proposedTarget = proposeTargetFromMedian(median);
    if (proposedTarget === currentTarget) continue; // rounding erased the change

    const dismissal = dismissalByCategory.get(category.id);
    if (
      dismissal &&
      dismissalSuppresses(dismissal, direction, currentTarget, median, now)
    ) {
      continue;
    }

    suggestions.push({
      name: category.name,
      suggestion: {
        categoryId: category.id,
        kind: category.kind,
        direction,
        currentTarget,
        proposedTarget,
        median,
        impact: Math.abs(proposedTarget - currentTarget),
      },
    });
  }

  // Largest dollar change first; name as a stable tie-break.
  suggestions.sort(
    (a, b) => b.suggestion.impact - a.suggestion.impact || a.name.localeCompare(b.name),
  );
  return suggestions.map((s) => s.suggestion);
}
