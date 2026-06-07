import type {
  Category,
  CategoryKind,
  CategoryTarget,
  Transaction,
} from "@/types/budget";

export function fmt(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  });
}

export function fmtExact(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function dayLabel(iso: string, today = new Date()): string {
  const todayIso = today.toISOString().slice(0, 10);
  if (iso === todayIso) return "Today";
  const y = new Date(today);
  y.setUTCDate(today.getUTCDate() - 1);
  if (iso === y.toISOString().slice(0, 10)) return "Yesterday";
  return new Date(iso + "T00:00:00Z").toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthLabelShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export function currentMonthKey(today = new Date()): string {
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentYearStart(today = new Date()): string {
  return `${today.getUTCFullYear()}-01-01`;
}

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
  bg: string;
  ring: string;
  dot: string;
  bar: string;
};

const PALETTE = {
  green: { text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40", ring: "ring-emerald-200 dark:ring-emerald-900", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  yellow: { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", ring: "ring-amber-200 dark:ring-amber-900", dot: "bg-amber-500", bar: "bg-amber-500" },
  orange: { text: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40", ring: "ring-orange-200 dark:ring-orange-900", dot: "bg-orange-500", bar: "bg-orange-500" },
  red: { text: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/40", ring: "ring-rose-200 dark:ring-rose-900", dot: "bg-rose-500", bar: "bg-rose-500" },
} satisfies Record<string, ThresholdPalette>;

export function thresholdColor(kind: Category["kind"], state: ThresholdState): ThresholdPalette {
  if (kind === "expense") {
    return { under: PALETTE.green, near: PALETTE.yellow, at: PALETTE.orange, over: PALETTE.red }[state];
  }
  return { under: PALETTE.red, near: PALETTE.orange, at: PALETTE.yellow, over: PALETTE.green }[state];
}

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
 * Yields every "YYYY-MM" key from `start` through `end`, inclusive. The two
 * strings are lexically comparable, which makes range checks elsewhere a
 * straight string comparison.
 */
export function* monthsInRange(start: string, end: string): Generator<string> {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    yield `${y}-${String(m).padStart(2, "0")}`;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
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
 * Inclusive lifecycle check against `activeFrom`/`activeUntil`. A category
 * with neither bound set is treated as always active (forward-compat with
 * the pre-migration data).
 */
export function isCategoryActiveForMonth(category: Category, ym: string): boolean {
  if (category.activeFrom && ym < category.activeFrom) return false;
  if (category.activeUntil && ym > category.activeUntil) return false;
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
