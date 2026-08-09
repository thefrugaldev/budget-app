import type {
  Category,
  CategoryTarget,
  MonthlyTrendPoint,
  RangeAggregate,
  TrailingActuals,
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

import { currentMonthKey, currentYearStart, monthsInRange, shiftMonth } from "./range";

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
 * Spend/save trend for the Pulse "Growth Columns" signature over the inclusive
 * month window `[startYm, endYm]` (oldest first), each month carrying the signed
 * sum of expense-category amounts (`spent`) and savings-category amounts
 * (`saved`). Income is excluded — the columns express outflow and contributions
 * against the plan, not earnings. The window is the page's selected date scope
 * (#160), so the signature redraws to whatever range the user picks — a calendar
 * year renders that year's twelve columns, a custom span its months. Every month
 * in the span gets a point (a zero-activity month is a genuine gap, not omitted),
 * so the axis stays continuous. Returns `[]` when `startYm > endYm`.
 */
export function rangeTrend(
  transactions: Transaction[],
  categories: Category[],
  startYm: string,
  endYm: string,
): MonthlyTrendPoint[] {
  const expenseIds = new Set(
    categories.filter((c) => c.kind === "expense").map((c) => c.id),
  );
  const savingsIds = new Set(
    categories.filter((c) => c.kind === "savings").map((c) => c.id),
  );

  // Seed every month in the window at zero (continuous axis), then bucket each
  // transaction once by its month key — a single O(transactions) pass rather
  // than O(months × transactions). The window is now unbounded ("All time" can
  // span years of imported history), so the per-month rescan the old fixed
  // 6-month trend used no longer holds. The Map keeps insertion (month) order,
  // so the values come back oldest-first; an inverted window seeds nothing.
  const byMonth = new Map<string, MonthlyTrendPoint>();
  for (const ym of monthsInRange(startYm, endYm)) {
    byMonth.set(ym, { ym, spent: 0, saved: 0 });
  }
  for (const t of transactions) {
    const point = byMonth.get(t.date.slice(0, 7));
    if (!point) continue;
    if (expenseIds.has(t.categoryId)) point.spent += t.amount;
    else if (savingsIds.has(t.categoryId)) point.saved += t.amount;
  }
  return [...byMonth.values()];
}

/**
 * Direction of the savings trend across the {@link monthlyTrend} columns, for
 * the chart caption (#178 story 10) — so the subtitle reflects the bars rather
 * than a static optimistic claim that can contradict them. The in-progress
 * current month (the last point) is a partial bar, so it's dropped from the
 * comparison when there's enough history: a not-yet-complete month must not read
 * as a fall. Compares the mean saved of the first half against the second half
 * with a 5% dead-band, so noise reads as flat (neutral).
 */
export function savedTrendDirection(
  data: MonthlyTrendPoint[],
): "rising" | "falling" | "flat" {
  const series = data.length > 2 ? data.slice(0, -1) : data;
  const saved = series.map((d) => Math.max(0, d.saved));
  if (saved.length < 2) return "flat";
  const mid = Math.floor(saved.length / 2);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const firstHalf = mean(saved.slice(0, mid));
  const secondHalf = mean(saved.slice(saved.length - mid));
  if (firstHalf === 0) return secondHalf > 0 ? "rising" : "flat";
  const change = (secondHalf - firstHalf) / firstHalf;
  if (change > 0.05) return "rising";
  if (change < -0.05) return "falling";
  return "flat";
}

/**
 * Trailing-full-month expense and savings averages — the data-derived defaults
 * for the FIRE assumptions (#110 chunk 1, stories 7/8). Averages the signed
 * expense and savings-contribution totals over the full calendar months ending
 * with the last **complete** month; the current, in-progress month is excluded
 * so a partial month can't drag the average. Same expense/savings-by-kind split
 * as {@link monthlyTrend} (income ignored, refunds/withdrawals net out).
 *
 * Fewer-months fallback: the denominator is the number of full months from the
 * user's earliest expense/savings activity through the last complete month,
 * capped at 12 — so a shorter history averages over what exists rather than
 * diluting against a fixed 12. With no expense/savings history the window is
 * empty and both averages are 0. Pure; no I/O.
 *
 * Deliberate choice on stale history: a user with pre-window activity but
 * nothing in the last 12 months reports `months: 12` at a $0 average — honest
 * "you haven't spent in a year, so $0/mo is the average" — rather than treating
 * no-in-window-activity as `months: 0` ("no data"). Don't flip this without
 * revisiting how the FIRE default should read that case.
 */
export function trailingActuals(
  transactions: Transaction[],
  categories: Category[],
  today = new Date(),
): TrailingActuals {
  const lastFull = shiftMonth(currentMonthKey(today), -1); // last complete month
  const windowStart = shiftMonth(lastFull, -11); // 12 full months back, inclusive

  const expenseIds = new Set(categories.filter((c) => c.kind === "expense").map((c) => c.id));
  const savingsIds = new Set(categories.filter((c) => c.kind === "savings").map((c) => c.id));

  let expenseSum = 0;
  let savingsSum = 0;
  let firstActivity: string | undefined; // earliest expense/savings month, any date
  for (const t of transactions) {
    const isExpense = expenseIds.has(t.categoryId);
    const isSavings = savingsIds.has(t.categoryId);
    if (!isExpense && !isSavings) continue;
    const ym = t.date.slice(0, 7);
    if (firstActivity === undefined || ym < firstActivity) firstActivity = ym;
    if (ym < windowStart || ym > lastFull) continue; // outside the full-month window
    if (isExpense) expenseSum += t.amount;
    else savingsSum += t.amount;
  }

  // Denominator: full months from first activity (clamped into the window)
  // through the last complete month, by direct arithmetic on the two keys.
  // Zero when history starts at/after the current partial month, or when
  // there's no expense/savings history at all.
  let months = 0;
  if (firstActivity !== undefined) {
    const start = firstActivity > windowStart ? firstActivity : windowStart;
    const [sy, sm] = start.split("-").map(Number);
    const [ly, lm] = lastFull.split("-").map(Number);
    months = Math.max(0, (ly - sy) * 12 + (lm - sm) + 1);
  }

  return {
    months,
    monthlyExpense: months > 0 ? expenseSum / months : 0,
    monthlySavings: months > 0 ? savingsSum / months : 0,
  };
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
 * The nearest **future-dated** target row for a category — the soonest one whose
 * `effectiveFrom` is strictly after `thisMonth` — or `undefined` when none is
 * scheduled. A target edited with the "apply next month" default (a manual edit
 * or an accepted suggestion) writes such a row, so the current view is unchanged
 * until the month arrives; callers use this to flag the upcoming change inline
 * (e.g. a `Cap $800/mo · ↓ $350/mo from Sep` header chip). Deliberately generic
 * — any future-dated row, not suggestion-specific — and reads target rows the
 * page already holds.
 */
export function nextScheduledTarget(
  categoryId: string,
  thisMonth: string,
  targetHistory: CategoryTarget[],
): CategoryTarget | undefined {
  let soonest: CategoryTarget | undefined;
  for (const row of targetHistory) {
    if (row.categoryId !== categoryId) continue;
    if (row.effectiveFrom <= thisMonth) continue;
    if (!soonest || row.effectiveFrom < soonest.effectiveFrom) soonest = row;
  }
  return soonest;
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
