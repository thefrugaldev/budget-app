import { currentMonthKey, shiftMonth } from "@/lib/budget";
import type { Transaction } from "@/types/budget";
import type { CategoryZeroState } from "@/types/category";

/**
 * Cadence inference for the Categories ledger's "nothing logged" signal. The
 * app has no explicit "recurring bill" flag (phase 1 has no recurrence), so
 * whether a $0 month is a *non-event* (a spend-limit category you happily
 * didn't touch) or a *missing bill* (mortgage not paid yet) is inferred from
 * transaction history: a category that has fired in most recent months is
 * "expected", and its silence this month is worth flagging.
 */

/** How many complete months back the cadence window looks. */
export const CADENCE_WINDOW_MONTHS = 4;
/** How many of those months must have activity to count as "expected". */
export const CADENCE_MIN_ACTIVE_MONTHS = 3;

/**
 * The set of category ids that look like **expected-monthly** spend/saving —
 * activity in at least `minActiveMonths` of the last `windowMonths` *complete*
 * months (the in-progress current month is excluded, since it's the one being
 * judged). A **sliding window** anchored at `now`: the window moves forward each
 * month, so a category earns the label after ~3 months of a new habit and loses
 * it a few months after the habit stops — no manual upkeep. Best-effort by
 * design (a quarterly bill reads as *not* expected), so callers phrase the
 * resulting signal softly. Single pass over `transactions`.
 */
export function expectedMonthlyCategories(
  transactions: Transaction[],
  now: Date,
  windowMonths: number = CADENCE_WINDOW_MONTHS,
  minActiveMonths: number = CADENCE_MIN_ACTIVE_MONTHS,
): Set<string> {
  const thisMonth = currentMonthKey(now);
  const windowStart = shiftMonth(thisMonth, -windowMonths); // inclusive
  // Distinct active months per category within [windowStart, thisMonth).
  const activeMonths = new Map<string, Set<string>>();
  for (const t of transactions) {
    const ym = t.date.slice(0, 7);
    if (ym < windowStart || ym >= thisMonth) continue;
    let months = activeMonths.get(t.categoryId);
    if (months === undefined) {
      months = new Set();
      activeMonths.set(t.categoryId, months);
    }
    months.add(ym);
  }
  const expected = new Set<string>();
  for (const [id, months] of activeMonths) {
    if (months.size >= minActiveMonths) expected.add(id);
  }
  return expected;
}

/**
 * Count of transactions per category within the inclusive month window
 * `[ymStart, ymEnd]`. Presence (count > 0) — not the signed total — is what
 * tells "nothing logged" apart from "activity that netted to zero" (a charge
 * plus its refund), so the ledger uses this rather than `total === 0`. Single
 * pass; a category with no in-range rows is simply absent (treat as 0).
 */
export function inRangeActivityCounts(
  transactions: Transaction[],
  ymStart: string,
  ymEnd: string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of transactions) {
    const ym = t.date.slice(0, 7);
    if (ym < ymStart || ym > ymEnd) continue;
    counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  }
  return counts;
}

/**
 * The "nothing logged" chip state for one category row, or `null` when the row
 * has in-range activity (it keeps its normal fulfillment chip). Scoped to
 * single-month views — the feature is month-centric ("nothing yet *this
 * month*"), and a "None yet" over a multi-month span would misread. The one
 * actionable, warn-toned state is an **expected** category silent in the
 * **in-progress current month** ("None yet"); every other zero is the neutral,
 * muted "Nothing logged" — which for a spend-limit category is quietly the good
 * outcome. Tone is reinforcement; the word carries the meaning (colourblind-safe).
 */
export function categoryZeroState(params: {
  inRangeCount: number;
  isSingleMonth: boolean;
  isCurrentMonth: boolean;
  isExpected: boolean;
}): CategoryZeroState | null {
  const { inRangeCount, isSingleMonth, isCurrentMonth, isExpected } = params;
  if (inRangeCount > 0) return null;
  if (!isSingleMonth) return null;
  if (isCurrentMonth && isExpected) return { label: "None yet", tone: "warn" };
  return { label: "Nothing logged", tone: "muted" };
}
