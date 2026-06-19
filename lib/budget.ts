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

export const RANGE_PRESETS = [
  "this-month",
  "last-month",
  "last-3-months",
  "ytd",
  "last-12-months",
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export type RangeSelection = {
  preset: RangePreset;
  ymStart: string;
  ymEnd: string;
};

const PRESET_LABELS: Record<RangePreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-3-months": "Last 3 months",
  ytd: "YTD",
  "last-12-months": "Last 12 months",
};

export function rangeLabel(preset: RangePreset): string {
  return PRESET_LABELS[preset];
}

export function isRangePreset(value: unknown): value is RangePreset {
  return typeof value === "string" && (RANGE_PRESETS as readonly string[]).includes(value);
}

function shiftMonth(ym: string, offset: number): string {
  const [y, m] = ym.split("-").map(Number);
  // JS Date normalizes overflow/underflow in month indices, which is what we want here.
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Next month key, e.g. `nextMonth("2026-12") === "2027-01"`. */
export function nextMonth(ym: string): string {
  return shiftMonth(ym, 1);
}

/**
 * Maps a preset to a `[ymStart, ymEnd]` window anchored at `today`. The end
 * is always the current month — even for YTD and Last-12, the in-progress
 * month is included so KPIs update as transactions land.
 */
export function resolveRange(preset: RangePreset, today = new Date()): RangeSelection {
  const thisMonth = currentMonthKey(today);
  switch (preset) {
    case "this-month":
      return { preset, ymStart: thisMonth, ymEnd: thisMonth };
    case "last-month": {
      const last = shiftMonth(thisMonth, -1);
      return { preset, ymStart: last, ymEnd: last };
    }
    case "last-3-months":
      return { preset, ymStart: shiftMonth(thisMonth, -2), ymEnd: thisMonth };
    case "ytd":
      return { preset, ymStart: `${today.getUTCFullYear()}-01`, ymEnd: thisMonth };
    case "last-12-months":
      return { preset, ymStart: shiftMonth(thisMonth, -11), ymEnd: thisMonth };
  }
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

/**
 * Human-readable label for what a category's monthly target represents.
 * Used in card sub-labels and detail-page headers.
 */
export function targetLabel(kind: CategoryKind): "Cap" | "Goal" | "Baseline" {
  switch (kind) {
    case "expense":
      return "Cap";
    case "savings":
      return "Goal";
    case "income":
      return "Baseline";
  }
}

/**
 * Vocabulary for the kind-aware sign-flip segmented control on the transaction
 * form. `positive` is the action a positive-amount transaction represents;
 * `negative` is the reversal. The two-way mapping keeps the form's mental
 * model honest regardless of which kind is selected (story 35).
 */
export type SignLabels = { positive: string; negative: string };
export function signLabelsFor(kind: CategoryKind): SignLabels {
  switch (kind) {
    case "expense":
      return { positive: "Spent", negative: "Refunded" };
    case "savings":
      return { positive: "Deposit", negative: "Withdraw" };
    case "income":
      return { positive: "Received", negative: "Reversed" };
  }
}

/**
 * Most-recent (by date, then insertion order) transaction in a category, used
 * to pre-fill `vendor` / `amount` / `note` on the Add Transaction form when
 * the user lands on a category with existing history (story 32). Returns
 * `undefined` for an empty category so callers can fall through to empty
 * defaults.
 *
 * Sign-aware: the absolute value is what the form's positive-only amount input
 * shows; the caller separately seeds the sign from the prefill transaction.
 */
export function mostRecentTransactionInCategory(
  transactions: Transaction[],
  categoryId: string,
): Transaction | undefined {
  // Tiebreaker on id (lexicographic, descending) so same-date rows have a
  // deterministic winner independent of input order — Mongo's sort isn't
  // stable across the same date, and React fixtures don't carry an order.
  let best: Transaction | undefined;
  for (const t of transactions) {
    if (t.categoryId !== categoryId) continue;
    if (!best) {
      best = t;
      continue;
    }
    if (t.date > best.date) best = t;
    else if (t.date === best.date && t.id > best.id) best = t;
  }
  return best;
}

/**
 * Frequency-ranked list of vendor strings for the autocomplete suggestion
 * popup (story 33). Vendors used in the selected category appear first
 * (ranked by count), then global vendors used elsewhere — deduped, blanks
 * dropped. Caller decides how many to show; the order is stable across
 * renders so the popup doesn't shift under the user.
 */
export function vendorSuggestionsForCategory(
  transactions: Transaction[],
  categoryId: string,
): string[] {
  const inCategory = new Map<string, number>();
  const global = new Map<string, number>();
  for (const t of transactions) {
    const v = t.vendor?.trim();
    if (!v) continue;
    global.set(v, (global.get(v) ?? 0) + 1);
    if (t.categoryId === categoryId) {
      inCategory.set(v, (inCategory.get(v) ?? 0) + 1);
    }
  }
  const byFreqDesc = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0]);
  const localOrdered = [...inCategory.entries()].sort(byFreqDesc).map(([v]) => v);
  const seen = new Set(localOrdered);
  const globalOrdered = [...global.entries()]
    .sort(byFreqDesc)
    .map(([v]) => v)
    .filter((v) => !seen.has(v));
  return [...localOrdered, ...globalOrdered];
}

export type TransactionFilter = {
  text?: string;
  vendor?: string;
  dateFrom?: string;
  dateTo?: string;
  /**
   * Cross-category constraint for the global `/transactions` list (issue #17
   * chunk 5, story 18). When present and non-empty, only rows whose
   * `categoryId` is in the set pass; an empty array or `undefined` means
   * "all categories" (the category-detail list never sets it — its rows are
   * already scoped to one category).
   */
  categoryIds?: string[];
};

/**
 * Predicate behind the transaction filter row — the category-detail list
 * (stories 24, 64) and the global `/transactions` list (chunk 5).
 * Free-text matches `vendor` and `note` case-insensitively. `vendor` is an
 * exact-match constraint used by the vendor dropdown; an empty/undefined
 * value means "all vendors". `categoryIds` is the global list's category
 * multi-select — empty/undefined means "all categories". Date bounds are
 * inclusive ISO `YYYY-MM-DD` strings — lexicographic comparison is safe
 * given the fixed shape.
 */
export function matchesTransactionFilter(
  t: Transaction,
  f: TransactionFilter,
): boolean {
  if (f.dateFrom && t.date < f.dateFrom) return false;
  if (f.dateTo && t.date > f.dateTo) return false;
  if (f.vendor && t.vendor !== f.vendor) return false;
  if (f.categoryIds && f.categoryIds.length > 0 && !f.categoryIds.includes(t.categoryId)) {
    return false;
  }
  const text = f.text?.trim().toLowerCase();
  if (text) {
    const inVendor = t.vendor?.toLowerCase().includes(text) ?? false;
    const inNote = t.note?.toLowerCase().includes(text) ?? false;
    if (!inVendor && !inNote) return false;
  }
  return true;
}
