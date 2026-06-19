import type { Category, CategoryTarget, Transaction } from "@/types/budget";

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
 * in `lib/income.ts`.
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
 * Total income earned across [rangeStart, rangeEnd], in dollars. Combines:
 *
 *   - the resolved monthly baseline target for each in-range month an income
 *     category was active. The current month is pro-rated by **calendar day**
 *     (`baseline × today.getUTCDate() / daysInMonth`), counted *inclusively*:
 *     on the 1st of the month one full day's worth of baseline is counted,
 *     not zero. This keeps the YTD savings rate moving smoothly past midnight
 *     on the 1st rather than jumping the moment a paycheck would have landed
 *     (story 51);
 *   - the signed sum of income-category transactions in the range — bonuses,
 *     RSU vests, side-gig income, etc. (story 52).
 *
 * Future months past `today`'s current month are skipped even if they fall in
 * the range, since baseline income hasn't happened yet.
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
  let baseline = 0;
  for (const ym of monthsInRange(rangeStart, rangeEnd)) {
    if (ym > thisMonth) continue; // future month — baseline hasn't happened
    for (const cat of incomeCategories) {
      if (!isCategoryActiveForMonth(cat, ym)) continue;
      const monthly = resolveTargetForMonth(cat.id, ym, targets);
      if (ym === thisMonth) {
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
