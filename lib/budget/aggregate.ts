import type {
  Category,
  CategoryTarget,
  MonthlyTrendPoint,
  Transaction,
} from "@/types/budget";
// Imported from the cycle-free cadence module (not the `@/lib/income` barrel) so
// this primitive layer doesn't take a dependency on the budget-using income
// helpers — see `lib/income/cadence.ts` for why.
import {
  paychecksInMonth,
  paychecksThroughDate,
  perPaycheckFromMonthly,
} from "@/lib/income/cadence";

import { currentMonthKey, currentYearStart, monthsInRange } from "./range";

export function ytdTotalsByCategory(
  transactions: Transaction[],
  categories: Category[],
  today = new Date(),
): Map<string, number> {
  const yearStart = currentYearStart(today);
  const todayIso = today.toISOString().slice(0, 10);
  const totals = new Map<string, number>();
  for (const c of categories) totals.set(c.id, 0);
  for (const t of transactions) {
    if (t.date < yearStart || t.date > todayIso) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return totals;
}

export function monthTotalsByCategory(
  transactions: Transaction[],
  categories: Category[],
  ym: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const c of categories) totals.set(c.id, 0);
  for (const t of transactions) {
    if (!t.date.startsWith(ym)) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  return totals;
}

export function monthlyTotalsLastN(
  transactions: Transaction[],
  categoryId: string,
  n: number,
  today = new Date(),
): { ym: string; total: number }[] {
  const out: { ym: string; total: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const total = transactions
      .filter((t) => t.categoryId === categoryId && t.date.startsWith(ym))
      .reduce((s, t) => s + t.amount, 0);
    out.push({ ym, total });
  }
  return out;
}

/**
 * Trailing spend/save trend for the Pulse "Growth Columns" signature: the last
 * `monthsBack` months (oldest first, current month last), each carrying the
 * signed sum of expense-category amounts (`spent`) and savings-category amounts
 * (`saved`) that month. Income is excluded — the columns express outflow and
 * contributions against the plan, not earnings. Kept independent of the page's
 * range selector so the signature always shows the same "over time" lens.
 */
export function monthlyTrend(
  transactions: Transaction[],
  categories: Category[],
  monthsBack: number,
  today = new Date(),
): MonthlyTrendPoint[] {
  const expenseIds = new Set(
    categories.filter((c) => c.kind === "expense").map((c) => c.id),
  );
  const savingsIds = new Set(
    categories.filter((c) => c.kind === "savings").map((c) => c.id),
  );

  const out: MonthlyTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    let spent = 0;
    let saved = 0;
    for (const t of transactions) {
      if (!t.date.startsWith(ym)) continue;
      if (expenseIds.has(t.categoryId)) spent += t.amount;
      else if (savingsIds.has(t.categoryId)) saved += t.amount;
    }
    out.push({ ym, spent, saved });
  }
  return out;
}

/**
 * The month's "plan" — the sum of resolved monthly targets across expense caps
 * and savings goals active that month. Drawn as the reference line the Growth
 * Columns climb toward. Income baselines are deliberately excluded: the plan is
 * total intended outflow (spending + saving), matching the two stacked series.
 * Returns 0 when nothing is targeted, which the signature reads as "no line".
 */
export function planTargetForMonth(
  categories: Category[],
  targetHistory: CategoryTarget[],
  ym: string,
): number {
  let sum = 0;
  for (const c of categories) {
    if (c.kind !== "expense" && c.kind !== "savings") continue;
    if (!isCategoryActiveForMonth(c, ym)) continue;
    sum += resolveTargetForMonth(c.id, ym, targetHistory);
  }
  return sum;
}

/**
 * Resolves the monthly target for `categoryId` at month `ym` by selecting
 * the target row with the greatest `effectiveFrom <= ym`. Returns 0 when no
 * row applies (e.g., month predates the category's first target).
 */
export function resolveTargetForMonth(
  categoryId: string,
  ym: string,
  targetHistory: CategoryTarget[],
): number {
  let best: CategoryTarget | undefined;
  for (const row of targetHistory) {
    if (row.categoryId !== categoryId) continue;
    if (row.effectiveFrom > ym) continue;
    if (!best || row.effectiveFrom > best.effectiveFrom) best = row;
  }
  return best ? best.monthly : 0;
}

/**
 * Inclusive lifecycle check against `activeFrom`/`activeUntil`. `activeUntil`
 * is optional — undefined means "no end". A row whose `activeUntil === ym`
 * is still active here (the month is part of its window); the income page's
 * status pill reads that same row as "ended" — see `classifyIncomeSourceStatus`
 * in `lib/income`.
 */
export function isCategoryActiveForMonth(category: Category, ym: string): boolean {
  if (ym < category.activeFrom) return false;
  if (category.activeUntil && ym > category.activeUntil) return false;
  return true;
}

/**
 * Returns true if the category's `[activeFrom, activeUntil]` window overlaps
 * the `[rangeStart, rangeEnd]` window at all (any single shared month). Used
 * by the Pulse overview to hide categories that are entirely outside the
 * active range — the detail page still loads them by id so history is
 * always reachable (story 12).
 */
export function isCategoryActiveInRange(
  category: Category,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (category.activeFrom > rangeEnd) return false;
  if (category.activeUntil && category.activeUntil < rangeStart) return false;
  return true;
}

/**
 * A category is "ended" when it has an end date set at all. This is the coarse
 * "has been retired" flag the category lifecycle UI keys off (the Edit sheet,
 * summary actions, and the `EndedBadge` all read `activeUntil` being present);
 * `isCategoryActiveForMonth` / `isCategoryActiveInRange` answer the finer "is
 * it live in *this* window" question Pulse uses to decide what to show.
 * Settings → Categories lists exactly the ended ones so a retired category can
 * be reviewed and reopened (#81 stories 7/8).
 */
export function isCategoryEnded(
  category: Category,
): category is Category & { activeUntil: string } {
  return category.activeUntil !== undefined;
}

export type RangeAggregate = {
  categoryId: string;
  total: number;
  denominator: number;
};

/**
 * Aggregates signed transaction amounts and effective-target sums over a
 * `[rangeStart, rangeEnd]` month window (both inclusive, "YYYY-MM"). The
 * denominator is the sum of resolved targets for the months in range during
 * which the category was active, so a mid-range raise or a category that
 * phases in partway through is honored.
 */
export function aggregateRange(
  transactions: Transaction[],
  categories: Category[],
  rangeStart: string,
  rangeEnd: string,
  targetHistory: CategoryTarget[],
): RangeAggregate[] {
  const months = [...monthsInRange(rangeStart, rangeEnd)];
  return categories.map((cat) => {
    let total = 0;
    for (const t of transactions) {
      if (t.categoryId !== cat.id) continue;
      const ym = t.date.slice(0, 7);
      if (ym < rangeStart || ym > rangeEnd) continue;
      total += t.amount;
    }
    let denominator = 0;
    for (const ym of months) {
      if (!isCategoryActiveForMonth(cat, ym)) continue;
      denominator += resolveTargetForMonth(cat.id, ym, targetHistory);
    }
    return { categoryId: cat.id, total, denominator };
  });
}

/**
 * Savings rate = saved / income. Returns `null` when income is zero so the
 * UI can render "n/a" rather than `NaN` or `Infinity`.
 */
export function computeSavingsRate(
  incomeForRange: number,
  savedForRange: number,
): number | null {
  if (incomeForRange === 0) return null;
  return savedForRange / incomeForRange;
}

function daysInUtcMonth(year: number, monthIndex0: number): number {
  // monthIndex0 is 0..11; the zeroth day of (monthIndex0 + 1) is the last day of monthIndex0.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Total income earned across [rangeStart, rangeEnd], in dollars. Combines a
 * baseline contribution per active income category with the signed sum of
 * income-category transactions in the range — bonuses, RSU vests, side-gig
 * income, etc. (story 52).
 *
 * The baseline is computed per `incomeFrequency` (#46):
 *
 *   - **Recurring with a `payCadence`** — paycheck-aware. Each in-range month
 *     contributes `perPaycheck × paychecks landed`, where the current month
 *     counts only paychecks on or before `today` and past months count the
 *     whole month. The per-paycheck amount is recovered from the resolved
 *     monthly baseline, so a mid-year raise still flows through. This keeps the
 *     YTD savings rate from drifting up before a paycheck has actually arrived
 *     (story 9). Paychecks are anchored to the source's `activeFrom` so the
 *     weekly/bi-weekly phase stays consistent across months.
 *   - **Recurring with no cadence (legacy)** — calendar-day pro-ration fallback
 *     (story 10): the current month is `monthly × today.getUTCDate() /
 *     daysInMonth`, counted *inclusively* (day 1 counts one day, not zero), and
 *     past months count the full `monthly`.
 *   - **One-time** — no baseline at all; a one-time source is measured purely by
 *     its receipts, which land via the transaction sum below.
 *
 * Future months past `today`'s current month are skipped even if they fall in
 * the range, since baseline income hasn't happened yet. A source that has ended
 * (`activeUntil` in the past) stops contributing once its window closes, so the
 * rate reflects the source actually being gone (story 16).
 */
export function computeIncomeForRange(
  incomeCategories: Category[],
  targets: CategoryTarget[],
  transactions: Transaction[],
  rangeStart: string,
  rangeEnd: string,
  today = new Date(),
): number {
  const thisMonth = currentMonthKey(today);
  const todayIso = today.toISOString().slice(0, 10);
  let baseline = 0;
  for (const ym of monthsInRange(rangeStart, rangeEnd)) {
    if (ym > thisMonth) continue; // future month — baseline hasn't happened
    for (const cat of incomeCategories) {
      if (!isCategoryActiveForMonth(cat, ym)) continue;
      // One-time sources have no baseline — they're measured by their receipts,
      // counted in the transaction sum below.
      if (cat.incomeFrequency === "one-time") continue;
      const monthly = resolveTargetForMonth(cat.id, ym, targets);
      const cadence = cat.payCadence;
      if (cadence) {
        // Anchor the schedule to the source's known payday when set, else the
        // first of `activeFrom`. The same anchor drives both the current month
        // (through today) and full past months, so the weekly/bi-weekly phase
        // stays consistent across every month we sum.
        const anchor = cat.firstPaycheckDate ?? `${cat.activeFrom}-01`;
        const paychecks =
          ym === thisMonth
            ? paychecksThroughDate(cadence, ym, todayIso, anchor)
            : paychecksInMonth(cadence, ym, anchor);
        baseline += perPaycheckFromMonthly(monthly, cadence) * paychecks;
      } else if (ym === thisMonth) {
        const dim = daysInUtcMonth(today.getUTCFullYear(), today.getUTCMonth());
        baseline += (monthly * today.getUTCDate()) / dim;
      } else {
        baseline += monthly;
      }
    }
  }

  let irregular = 0;
  const incomeIds = new Set(incomeCategories.map((c) => c.id));
  for (const t of transactions) {
    if (!incomeIds.has(t.categoryId)) continue;
    const ym = t.date.slice(0, 7);
    if (ym < rangeStart || ym > rangeEnd) continue;
    irregular += t.amount;
  }

  return baseline + irregular;
}

/**
 * Sum of resolved monthly baselines for `ym`, across income categories that
 * are active that month. The Pulse header annualizes this (× 12) for the
 * "Current total income" display.
 */
export function currentMonthlyBaseline(
  incomeCategories: Category[],
  targets: CategoryTarget[],
  ym: string,
): number {
  let sum = 0;
  for (const cat of incomeCategories) {
    if (!isCategoryActiveForMonth(cat, ym)) continue;
    sum += resolveTargetForMonth(cat.id, ym, targets);
  }
  return sum;
}
