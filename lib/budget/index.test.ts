import { describe, expect, it } from "vitest";
import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import {
  aggregateRange,
  computeIncomeForRange,
  computeSavingsRate,
  currentMonthlyBaseline,
  isCategoryActiveForMonth,
  isCategoryActiveInRange,
  isRangePreset,
  longDateLabel,
  matchesTransactionFilter,
  monthTotalsByCategory,
  monthlyTotalsLastN,
  monthsInRange,
  mostRecentTransactionInCategory,
  nextMonth,
  rangeLabel,
  resolveRange,
  resolveTargetForMonth,
  signLabelsFor,
  targetLabel,
  thresholdColor,
  thresholdDescriptor,
  thresholdFor,
  vendorSuggestionsForCategory,
  ytdTotalsByCategory,
  type RangePreset,
} from ".";

const expenseCat = (overrides: Partial<Category> = {}): Category => ({
  id: "groc",
  name: "Groceries",
  emoji: "🛒",
  kind: "expense",
  activeFrom: "2026-01",
  ...overrides,
});

const savingsCat = (overrides: Partial<Category> = {}): Category => ({
  id: "hysa",
  name: "HYSA",
  emoji: "💰",
  kind: "savings",
  activeFrom: "2026-01",
  ...overrides,
});

const incomeCat = (overrides: Partial<Category> = {}): Category => ({
  id: "salary",
  name: "Salary",
  emoji: "💼",
  kind: "income",
  activeFrom: "2026-01",
  ...overrides,
});

const tx = (overrides: Partial<Transaction> & Pick<Transaction, "id">): Transaction => ({
  categoryId: "groc",
  amount: 100,
  date: "2026-06-01",
  ...overrides,
});

describe("monthsInRange", () => {
  it("yields a single month when start === end", () => {
    expect([...monthsInRange("2026-06", "2026-06")]).toEqual(["2026-06"]);
  });

  it("yields months inclusive of both bounds", () => {
    expect([...monthsInRange("2026-01", "2026-03")]).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("rolls over years", () => {
    expect([...monthsInRange("2025-11", "2026-02")]).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("yields nothing when end precedes start", () => {
    expect([...monthsInRange("2026-06", "2026-03")]).toEqual([]);
  });
});

describe("resolveTargetForMonth", () => {
  const history: CategoryTarget[] = [
    { categoryId: "groc", monthly: 800, effectiveFrom: "2026-01" },
    { categoryId: "groc", monthly: 900, effectiveFrom: "2026-04" },
    { categoryId: "rent", monthly: 2000, effectiveFrom: "2026-01" },
  ];

  const cases: Array<{ name: string; ym: string; expected: number }> = [
    { name: "exact match on effectiveFrom", ym: "2026-01", expected: 800 },
    { name: "month between rows uses the earlier row", ym: "2026-03", expected: 800 },
    { name: "a target raised in April still rules March", ym: "2026-03", expected: 800 },
    { name: "month at the raise picks up the new value", ym: "2026-04", expected: 900 },
    { name: "month past the latest row keeps the latest value", ym: "2026-12", expected: 900 },
    { name: "month before any row returns 0", ym: "2025-12", expected: 0 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(resolveTargetForMonth("groc", c.ym, history)).toBe(c.expected);
    });
  }

  it("ignores rows for other categories", () => {
    expect(resolveTargetForMonth("rent", "2026-06", history)).toBe(2000);
  });

  it("returns 0 when the category has no rows", () => {
    expect(resolveTargetForMonth("unknown", "2026-06", history)).toBe(0);
  });

  it("returns 0 when the history is empty", () => {
    expect(resolveTargetForMonth("groc", "2026-06", [])).toBe(0);
  });
});

describe("isCategoryActiveForMonth", () => {
  const cases: Array<{
    name: string;
    cat: Category;
    ym: string;
    expected: boolean;
  }> = [
    {
      name: "no bounds means always active",
      cat: expenseCat(),
      ym: "2026-06",
      expected: true,
    },
    {
      name: "activeFrom is inclusive (month equals activeFrom)",
      cat: expenseCat({ activeFrom: "2026-06" }),
      ym: "2026-06",
      expected: true,
    },
    {
      name: "month before activeFrom is inactive",
      cat: expenseCat({ activeFrom: "2026-06" }),
      ym: "2026-05",
      expected: false,
    },
    {
      name: "activeUntil is inclusive (month equals activeUntil)",
      cat: expenseCat({ activeUntil: "2026-06" }),
      ym: "2026-06",
      expected: true,
    },
    {
      name: "month after activeUntil is inactive",
      cat: expenseCat({ activeUntil: "2026-06" }),
      ym: "2026-07",
      expected: false,
    },
    {
      name: "month inside [activeFrom, activeUntil] is active",
      cat: expenseCat({ activeFrom: "2026-01", activeUntil: "2026-12" }),
      ym: "2026-06",
      expected: true,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(isCategoryActiveForMonth(c.cat, c.ym)).toBe(c.expected);
    });
  }
});

describe("isCategoryActiveInRange", () => {
  const rangeCases: Array<{
    name: string;
    cat: Category;
    start: string;
    end: string;
    expected: boolean;
  }> = [
    {
      name: "category with no end always overlaps a forward range",
      cat: expenseCat({ activeFrom: "2026-01" }),
      start: "2026-06",
      end: "2026-08",
      expected: true,
    },
    {
      name: "category that ends before the range starts is excluded",
      cat: expenseCat({ activeFrom: "2025-01", activeUntil: "2025-12" }),
      start: "2026-01",
      end: "2026-03",
      expected: false,
    },
    {
      name: "category that starts after the range ends is excluded",
      cat: expenseCat({ activeFrom: "2026-09" }),
      start: "2026-01",
      end: "2026-06",
      expected: false,
    },
    {
      name: "single-month overlap on the upper boundary is included",
      cat: expenseCat({ activeFrom: "2026-06", activeUntil: "2026-06" }),
      start: "2026-04",
      end: "2026-06",
      expected: true,
    },
    {
      name: "single-month overlap on the lower boundary is included",
      cat: expenseCat({ activeFrom: "2026-04", activeUntil: "2026-04" }),
      start: "2026-04",
      end: "2026-06",
      expected: true,
    },
  ];

  for (const c of rangeCases) {
    it(c.name, () => {
      expect(isCategoryActiveInRange(c.cat, c.start, c.end)).toBe(c.expected);
    });
  }
});

describe("aggregateRange", () => {
  const groc = expenseCat({ id: "groc" });
  const hysa = savingsCat({ id: "hysa" });

  it("sums signed transaction amounts within the range", () => {
    const txs: Transaction[] = [
      tx({ id: "1", categoryId: "groc", amount: 200, date: "2026-06-01" }),
      tx({ id: "2", categoryId: "groc", amount: 100, date: "2026-06-15" }),
      tx({ id: "3", categoryId: "groc", amount: -25, date: "2026-06-20" }), // refund
      tx({ id: "4", categoryId: "groc", amount: 999, date: "2026-05-31" }), // out of range
      tx({ id: "5", categoryId: "groc", amount: 999, date: "2026-07-01" }), // out of range
    ];
    const history: CategoryTarget[] = [
      { categoryId: "groc", monthly: 800, effectiveFrom: "2026-01" },
    ];

    const [row] = aggregateRange(txs, [groc], "2026-06", "2026-06", history);
    expect(row).toEqual({ categoryId: "groc", total: 275, denominator: 800 });
  });

  it("denominator sums historically effective targets across months", () => {
    const history: CategoryTarget[] = [
      { categoryId: "groc", monthly: 800, effectiveFrom: "2026-01" },
      { categoryId: "groc", monthly: 900, effectiveFrom: "2026-03" },
    ];

    const [row] = aggregateRange([], [groc], "2026-01", "2026-03", history);
    expect(row.denominator).toBe(800 + 800 + 900);
  });

  it("excludes inactive months from the denominator", () => {
    const phasedIn = expenseCat({ id: "groc", activeFrom: "2026-02" });
    const history: CategoryTarget[] = [
      { categoryId: "groc", monthly: 800, effectiveFrom: "2026-01" },
    ];

    const [row] = aggregateRange([], [phasedIn], "2026-01", "2026-03", history);
    expect(row.denominator).toBe(800 + 800); // Feb + Mar only
  });

  it("allows a net-negative total for a category (withdrawal exceeds deposits)", () => {
    const txs: Transaction[] = [
      tx({ id: "1", categoryId: "hysa", amount: 100, date: "2026-06-01" }),
      tx({ id: "2", categoryId: "hysa", amount: -400, date: "2026-06-20" }),
    ];
    const history: CategoryTarget[] = [
      { categoryId: "hysa", monthly: 500, effectiveFrom: "2026-01" },
    ];

    const [row] = aggregateRange(txs, [hysa], "2026-06", "2026-06", history);
    expect(row.total).toBe(-300);
  });

  it("returns a row for every category, even when there are no transactions", () => {
    const rows = aggregateRange([], [groc, hysa], "2026-06", "2026-06", []);
    expect(rows).toEqual([
      { categoryId: "groc", total: 0, denominator: 0 },
      { categoryId: "hysa", total: 0, denominator: 0 },
    ]);
  });
});

describe("computeSavingsRate", () => {
  const cases: Array<{
    name: string;
    income: number;
    saved: number;
    expected: number | null;
  }> = [
    { name: "zero income returns null (n/a)", income: 0, saved: 0, expected: null },
    { name: "zero income with saved still returns null", income: 0, saved: 500, expected: null },
    { name: "30% savings rate", income: 100, saved: 30, expected: 0.3 },
    { name: "100% savings rate", income: 100, saved: 100, expected: 1 },
    { name: "negative saved drags the rate negative", income: 100, saved: -20, expected: -0.2 },
    { name: "over 100% (saved more than earned in window)", income: 100, saved: 150, expected: 1.5 },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(computeSavingsRate(c.income, c.saved)).toBe(c.expected);
    });
  }
});

describe("longDateLabel", () => {
  it("formats a YYYY-MM-DD date as a full calendar date, UTC-pinned", () => {
    expect(longDateLabel("2026-05-15")).toBe("May 15, 2026");
    expect(longDateLabel("2026-01-01")).toBe("January 1, 2026");
    expect(longDateLabel("2026-12-31")).toBe("December 31, 2026");
  });
});

describe("nextMonth", () => {
  it("advances within a year", () => {
    expect(nextMonth("2026-06")).toBe("2026-07");
  });

  it("rolls December to January of the next year", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});

describe("targetLabel", () => {
  it("returns Cap for expense, Goal for savings, Baseline for income", () => {
    expect(targetLabel("expense")).toBe("Cap");
    expect(targetLabel("savings")).toBe("Goal");
    expect(targetLabel("income")).toBe("Baseline");
  });
});

describe("currentMonthlyBaseline", () => {
  const salary = incomeCat({ id: "salary" });
  const sideGig = incomeCat({ id: "gig", activeFrom: "2026-03" });

  const history: CategoryTarget[] = [
    { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
    { categoryId: "salary", monthly: 8000, effectiveFrom: "2026-07" },
    { categoryId: "gig", monthly: 500, effectiveFrom: "2026-03" },
  ];

  it("sums effective baselines for the given month", () => {
    expect(currentMonthlyBaseline([salary, sideGig], history, "2026-06")).toBe(8000);
  });

  it("picks up a raise that takes effect at the queried month", () => {
    expect(currentMonthlyBaseline([salary, sideGig], history, "2026-07")).toBe(8500);
  });

  it("excludes categories that aren't active in the month", () => {
    // sideGig.activeFrom === 2026-03, so in 2026-02 only salary contributes.
    expect(currentMonthlyBaseline([salary, sideGig], history, "2026-02")).toBe(7500);
  });

  it("excludes ended categories (activeUntil < ym)", () => {
    const ended = incomeCat({ id: "gig", activeFrom: "2026-03", activeUntil: "2026-05" });
    expect(currentMonthlyBaseline([salary, ended], history, "2026-06")).toBe(7500);
  });

  it("returns 0 when no income categories are passed", () => {
    expect(currentMonthlyBaseline([], history, "2026-06")).toBe(0);
  });
});

describe("computeIncomeForRange", () => {
  const salary = incomeCat({ id: "salary" });
  const history: CategoryTarget[] = [
    { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
  ];

  it("pro-rates the current month by day elapsed", () => {
    // 2026-06-09 → 9 / 30 days of the month elapsed.
    const today = new Date("2026-06-09T00:00:00Z");
    const inc = computeIncomeForRange([salary], history, [], "2026-06", "2026-06", today);
    expect(inc).toBeCloseTo((7500 * 9) / 30, 5);
  });

  it("counts elapsed months in full and pro-rates only the current month", () => {
    const today = new Date("2026-03-15T00:00:00Z");
    // Jan + Feb full, March 15/31 pro-rated.
    const inc = computeIncomeForRange([salary], history, [], "2026-01", "2026-03", today);
    expect(inc).toBeCloseTo(7500 + 7500 + (7500 * 15) / 31, 5);
  });

  it("honors a mid-range raise via target history", () => {
    const raisedHistory: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
      { categoryId: "salary", monthly: 9000, effectiveFrom: "2026-04" },
    ];
    // YTD on May 1: Jan/Feb/Mar at 7500, Apr at 9000, May pro-rated at 9000 × 1/31.
    const today = new Date("2026-05-01T00:00:00Z");
    const inc = computeIncomeForRange(
      [salary],
      raisedHistory,
      [],
      "2026-01",
      "2026-05",
      today,
    );
    expect(inc).toBeCloseTo(7500 * 3 + 9000 + (9000 * 1) / 31, 5);
  });

  it("adds signed transactions on income categories (e.g. bonus)", () => {
    const today = new Date("2026-03-31T00:00:00Z");
    const bonus: Transaction = {
      id: "bonus",
      categoryId: "salary",
      amount: 5000,
      date: "2026-03-15",
    };
    // Jan + Feb full at 7500, March pro-rated at 31/31 = full, plus 5000 bonus.
    const inc = computeIncomeForRange(
      [salary],
      history,
      [bonus],
      "2026-01",
      "2026-03",
      today,
    );
    expect(inc).toBeCloseTo(7500 * 3 + 5000, 5);
  });

  it("nets a reversed-income transaction (negative amount)", () => {
    const today = new Date("2026-06-30T00:00:00Z");
    const reversal: Transaction = {
      id: "rev",
      categoryId: "salary",
      amount: -200,
      date: "2026-06-10",
    };
    const inc = computeIncomeForRange(
      [salary],
      history,
      [reversal],
      "2026-06",
      "2026-06",
      today,
    );
    expect(inc).toBeCloseTo(7500 - 200, 5);
  });

  it("excludes future months that fall in range past today's month", () => {
    // YTD on Feb 1 → range is Jan..Feb, current is Feb. Future months are
    // never in range here, but a "last-12-months"-style preset could include
    // months past today; verify the guard.
    const today = new Date("2026-02-01T00:00:00Z");
    const inc = computeIncomeForRange([salary], history, [], "2026-01", "2026-05", today);
    expect(inc).toBeCloseTo(7500 + (7500 * 1) / 28, 5); // Jan full + Feb day 1
  });

  it("excludes inactive months from the baseline", () => {
    const phased = incomeCat({ id: "salary", activeFrom: "2026-03" });
    const today = new Date("2026-04-30T00:00:00Z");
    // Jan/Feb inactive → 0; Mar full; Apr pro-rated 30/30.
    const inc = computeIncomeForRange([phased], history, [], "2026-01", "2026-04", today);
    expect(inc).toBeCloseTo(7500 + (7500 * 30) / 30, 5);
  });

  it("ignores transactions on non-income categories", () => {
    const today = new Date("2026-06-30T00:00:00Z");
    const spend: Transaction = {
      id: "s",
      categoryId: "groc",
      amount: 100,
      date: "2026-06-10",
    };
    const inc = computeIncomeForRange(
      [salary],
      history,
      [spend],
      "2026-06",
      "2026-06",
      today,
    );
    // 30/30 of monthly baseline; spend ignored entirely.
    expect(inc).toBeCloseTo(7500, 5);
  });

  it("returns 0 when no income categories are configured", () => {
    const today = new Date("2026-06-09T00:00:00Z");
    expect(computeIncomeForRange([], history, [], "2026-06", "2026-06", today)).toBe(0);
  });

  // #46 chunk 6 — paycheck-aware pro-ration for cadence-set recurring sources.
  const perCheck = (7500 * 12) / 26; // bi-weekly per-paycheck for a 7500/mo baseline

  it("pro-rates the current month by paychecks landed, not calendar days (story 9)", () => {
    // Bi-weekly anchored to activeFrom (2026-01-01): June paydays are the 4th
    // and 18th. Through June 15 only the 4th has landed → 1 paycheck, NOT
    // 15/30 of the monthly baseline.
    const biweekly = incomeCat({ id: "salary", payCadence: "bi-weekly" });
    const today = new Date("2026-06-15T00:00:00Z");
    const inc = computeIncomeForRange([biweekly], history, [], "2026-06", "2026-06", today);
    expect(inc).toBeCloseTo(perCheck * 1, 5);
  });

  it("counts paychecks per month across full past months (not month × monthly)", () => {
    // Jan has 3 bi-weekly paydays (1/15/29), Feb has 2 (12/26) → 5 paychecks.
    // A calendar/month-count view would give 2 × 7500; paycheck-aware gives 5×.
    const biweekly = incomeCat({ id: "salary", payCadence: "bi-weekly" });
    const today = new Date("2026-03-01T00:00:00Z");
    const inc = computeIncomeForRange([biweekly], history, [], "2026-01", "2026-02", today);
    expect(inc).toBeCloseTo(perCheck * 5, 5);
  });

  it("honors a mid-year raise through the per-paycheck amount", () => {
    const raisedHistory: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
      { categoryId: "salary", monthly: 9000, effectiveFrom: "2026-02" },
    ];
    const biweekly = incomeCat({ id: "salary", payCadence: "bi-weekly" });
    const today = new Date("2026-03-01T00:00:00Z");
    // Jan (3 checks) at 7500/mo, Feb (2 checks) at 9000/mo.
    const inc = computeIncomeForRange([biweekly], raisedHistory, [], "2026-01", "2026-02", today);
    expect(inc).toBeCloseTo((7500 * 12 / 26) * 3 + (9000 * 12 / 26) * 2, 5);
  });

  it("pays a monthly-cadence source in full on its payday, not pro-rated by day", () => {
    // Monthly cadence pays on the anchor's day-of-month (the 1st). On June 1 the
    // whole paycheck has landed — 7500, not 7500 × 1/30.
    const monthlyCadence = incomeCat({ id: "salary", payCadence: "monthly" });
    const today = new Date("2026-06-01T00:00:00Z");
    const inc = computeIncomeForRange([monthlyCadence], history, [], "2026-06", "2026-06", today);
    expect(inc).toBeCloseTo(7500, 5);
  });

  it("keeps calendar-day pro-ration for a cadence-unset recurring source (story 10)", () => {
    // incomeFrequency set but no payCadence (e.g. migrated legacy) → fallback.
    const legacy = incomeCat({ id: "salary", incomeFrequency: "recurring" });
    const today = new Date("2026-06-09T00:00:00Z");
    const inc = computeIncomeForRange([legacy], history, [], "2026-06", "2026-06", today);
    expect(inc).toBeCloseTo((7500 * 9) / 30, 5);
  });

  it("gives one-time sources no baseline — only their receipts count", () => {
    // Even with a stray target row, a one-time source contributes no baseline;
    // its $12,500 vest is the only income.
    const oneTime = incomeCat({ id: "salary", incomeFrequency: "one-time" });
    const vest: Transaction = {
      id: "vest",
      categoryId: "salary",
      amount: 12500,
      date: "2026-06-10",
    };
    const today = new Date("2026-06-30T00:00:00Z");
    const inc = computeIncomeForRange([oneTime], history, [vest], "2026-06", "2026-06", today);
    expect(inc).toBeCloseTo(12500, 5);
  });

  it("stops accruing once an ended source's window closes (story 16)", () => {
    // Bi-weekly source ended in April: Jan–Apr contribute 9 paychecks; May/June
    // (after activeUntil, though before today) contribute nothing.
    const ended = incomeCat({
      id: "salary",
      payCadence: "bi-weekly",
      activeUntil: "2026-04",
    });
    const today = new Date("2026-06-20T00:00:00Z");
    const inc = computeIncomeForRange([ended], history, [], "2026-01", "2026-06", today);
    expect(inc).toBeCloseTo(perCheck * 9, 5);
  });

  it("anchors paydays to firstPaycheckDate when set, shifting the phase", () => {
    // Default anchor (first of activeFrom = 2026-01-01) puts June paydays on the
    // 4th & 18th → 1 landed through June 15. A firstPaycheckDate of 2026-06-15
    // re-phases them to the 1st/15th/29th → 2 landed through June 15.
    const anchored = incomeCat({
      id: "salary",
      payCadence: "bi-weekly",
      firstPaycheckDate: "2026-06-15",
    });
    const today = new Date("2026-06-15T00:00:00Z");
    const inc = computeIncomeForRange([anchored], history, [], "2026-06", "2026-06", today);
    expect(inc).toBeCloseTo(perCheck * 2, 5);
  });

  it("applies firstPaycheckDate to full past months too, not just the current one", () => {
    // Same Jan–Feb window as the default-anchor test above (which lands 5
    // paychecks), but anchored to the 14th: paydays fall Jan 14/28, Feb 11/25 →
    // 4 paychecks. Proves the anchor drives past-month counts, not only the
    // current month's pro-ration.
    const anchored = incomeCat({
      id: "salary",
      payCadence: "bi-weekly",
      firstPaycheckDate: "2026-01-14",
    });
    const today = new Date("2026-03-01T00:00:00Z");
    const inc = computeIncomeForRange([anchored], history, [], "2026-01", "2026-02", today);
    expect(inc).toBeCloseTo(perCheck * 4, 5);
  });
});

describe("thresholdFor negative-pct cases", () => {
  const cases: Array<{
    name: string;
    kind: Category["kind"];
    target: number;
    amount: number;
    expected: ReturnType<typeof thresholdFor>;
  }> = [
    {
      name: "expense with a net refund (negative amount) is under",
      kind: "expense",
      target: 800,
      amount: -50,
      expected: "under",
    },
    {
      name: "savings with a net withdrawal (negative amount) is under",
      kind: "savings",
      target: 500,
      amount: -200,
      expected: "under",
    },
    {
      name: "income with a net reversal (negative amount) is under",
      kind: "income",
      target: 8000,
      amount: -100,
      expected: "under",
    },
    {
      name: "expense with target=0 and zero spend is under",
      kind: "expense",
      target: 0,
      amount: 0,
      expected: "under",
    },
    {
      name: "savings with target=0 and zero contribution is under",
      kind: "savings",
      target: 0,
      amount: 0,
      expected: "under",
    },
    {
      name: "expense with target=0 and positive spend is under (no target to compare against)",
      kind: "expense",
      target: 0,
      amount: 50,
      expected: "under",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(thresholdFor(c.kind, c.target, c.amount)).toBe(c.expected);
    });
  }
});

describe("thresholdFor income kind — positive-side boundaries", () => {
  // Income shares the goal-oriented code path with savings (over = good).
  // Cover the under/near/at/over boundaries explicitly so a future refactor
  // that splits income into its own branch can't drift.
  const target = 1000;
  const cases: Array<{ name: string; amount: number; expected: ReturnType<typeof thresholdFor> }> = [
    { name: "well under target → under", amount: 500, expected: "under" },
    { name: "just below 70% → under", amount: 699, expected: "under" },
    { name: "at 70% → near", amount: 700, expected: "near" },
    { name: "just below 90% → near", amount: 899, expected: "near" },
    { name: "at 90% → at", amount: 900, expected: "at" },
    { name: "just below 100% → at", amount: 999, expected: "at" },
    { name: "exactly at target → over", amount: 1000, expected: "over" },
    { name: "beyond target → over", amount: 1500, expected: "over" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(thresholdFor("income", target, c.amount)).toBe(c.expected);
    });
  }

  it("aligns with the incomeCat helper", () => {
    const cat = incomeCat();
    expect(thresholdFor(cat.kind, 5000, 6000)).toBe("over");
  });
});

describe("thresholdColor — three-signal palette", () => {
  // Locks the green/amber/red mapping. The headline regression: a savings
  // contribution at 50% of goal used to render red (matching an over-cap
  // expense). The non-expense branch is now sign-driven, not state-driven.
  type Kind = Category["kind"];
  const cases: Array<{
    name: string;
    kind: Kind;
    target: number;
    amount: number;
    signal: "good" | "warn" | "bad";
  }> = [
    { name: "expense well under cap → good", kind: "expense", target: 800, amount: 100, signal: "good" },
    { name: "expense at 75% of cap (near) → good", kind: "expense", target: 800, amount: 600, signal: "good" },
    { name: "expense at 95% of cap (at) → warn", kind: "expense", target: 800, amount: 760, signal: "warn" },
    { name: "expense at exactly the cap → warn", kind: "expense", target: 800, amount: 800, signal: "warn" },
    { name: "expense beyond cap → bad", kind: "expense", target: 800, amount: 900, signal: "bad" },
    { name: "expense with a net refund → good (no cap pressure)", kind: "expense", target: 800, amount: -50, signal: "good" },
    { name: "savings at 50% of goal → good (bug fix)", kind: "savings", target: 1000, amount: 500, signal: "good" },
    { name: "savings exceeded goal → good", kind: "savings", target: 1000, amount: 1500, signal: "good" },
    { name: "savings net-negative (withdrawal) → bad", kind: "savings", target: 1000, amount: -200, signal: "bad" },
    { name: "income partial month → good", kind: "income", target: 8000, amount: 3000, signal: "good" },
    { name: "income net-negative (reversal) → bad", kind: "income", target: 8000, amount: -100, signal: "bad" },
    { name: "savings target=0 with positive contribution → good", kind: "savings", target: 0, amount: 50, signal: "good" },
  ];

  const SIGNAL_TEXT = {
    good: "text-signal-good-foreground",
    warn: "text-signal-warn-foreground",
    bad: "text-signal-bad-foreground",
  };
  const SIGNAL_BAR = {
    good: "bg-signal-good",
    warn: "bg-signal-warn",
    bad: "bg-signal-bad",
  };

  for (const c of cases) {
    it(c.name, () => {
      const col = thresholdColor(c.kind, c.target, c.amount);
      expect(col.text).toBe(SIGNAL_TEXT[c.signal]);
      expect(col.bar).toBe(SIGNAL_BAR[c.signal]);
    });
  }
});

describe("thresholdDescriptor — text-bearing, non-color signal", () => {
  // Each state must carry a word (not just color), and the word + tone must
  // honor the expense/savings meaning-flip: "over" is bad for an expense cap
  // but good for a savings goal.
  type Kind = Category["kind"];
  const cases: Array<{
    name: string;
    kind: Kind;
    target: number;
    amount: number;
    label: string;
    tone: "good" | "warn" | "bad";
  }> = [
    { name: "expense well under cap", kind: "expense", target: 800, amount: 100, label: "Under cap", tone: "good" },
    { name: "expense near cap (75%)", kind: "expense", target: 800, amount: 600, label: "Near cap", tone: "good" },
    { name: "expense at the cap", kind: "expense", target: 800, amount: 800, label: "At cap", tone: "warn" },
    { name: "expense over the cap", kind: "expense", target: 800, amount: 900, label: "Over cap", tone: "bad" },
    { name: "expense with a net refund stays good", kind: "expense", target: 800, amount: -50, label: "Under cap", tone: "good" },
    { name: "savings early progress", kind: "savings", target: 1000, amount: 200, label: "On track", tone: "good" },
    { name: "savings near goal (80%)", kind: "savings", target: 1000, amount: 800, label: "Near goal", tone: "good" },
    { name: "savings at goal — over is GOOD here", kind: "savings", target: 1000, amount: 1500, label: "Goal met", tone: "good" },
    { name: "savings net-negative (withdrawal)", kind: "savings", target: 1000, amount: -200, label: "Withdrawn", tone: "bad" },
    { name: "income partial month", kind: "income", target: 8000, amount: 3000, label: "On track", tone: "good" },
    { name: "income net-negative (reversal)", kind: "income", target: 8000, amount: -100, label: "Withdrawn", tone: "bad" },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const d = thresholdDescriptor(c.kind, c.target, c.amount);
      expect(d.label).toBe(c.label);
      expect(d.tone).toBe(c.tone);
    });
  }

  it("tone always agrees with thresholdColor's signal", () => {
    const toBar = { good: "bg-signal-good", warn: "bg-signal-warn", bad: "bg-signal-bad" };
    for (const c of cases) {
      const d = thresholdDescriptor(c.kind, c.target, c.amount);
      expect(thresholdColor(c.kind, c.target, c.amount).bar).toBe(toBar[d.tone]);
    }
  });
});

describe("resolveRange", () => {
  // Anchor every case at 2026-06-08 so the assertions are deterministic.
  const today = new Date("2026-06-08T00:00:00Z");

  const cases: Array<{
    preset: RangePreset;
    ymStart: string;
    ymEnd: string;
  }> = [
    { preset: "this-month", ymStart: "2026-06", ymEnd: "2026-06" },
    { preset: "last-month", ymStart: "2026-05", ymEnd: "2026-05" },
    { preset: "last-3-months", ymStart: "2026-04", ymEnd: "2026-06" },
    { preset: "ytd", ymStart: "2026-01", ymEnd: "2026-06" },
    { preset: "last-12-months", ymStart: "2025-07", ymEnd: "2026-06" },
  ];

  for (const c of cases) {
    it(`${c.preset} → [${c.ymStart}, ${c.ymEnd}]`, () => {
      expect(resolveRange(c.preset, today)).toEqual({
        preset: c.preset,
        ymStart: c.ymStart,
        ymEnd: c.ymEnd,
      });
    });
  }

  it("last-month rolls year backward in January", () => {
    const jan = new Date("2026-01-15T00:00:00Z");
    expect(resolveRange("last-month", jan)).toEqual({
      preset: "last-month",
      ymStart: "2025-12",
      ymEnd: "2025-12",
    });
  });

  it("last-12-months spans Dec→Nov across a year boundary", () => {
    const dec = new Date("2026-12-15T00:00:00Z");
    expect(resolveRange("last-12-months", dec)).toEqual({
      preset: "last-12-months",
      ymStart: "2026-01",
      ymEnd: "2026-12",
    });
  });

  it("ytd in January is the single-month range Jan→Jan", () => {
    const jan = new Date("2026-01-15T00:00:00Z");
    expect(resolveRange("ytd", jan)).toEqual({
      preset: "ytd",
      ymStart: "2026-01",
      ymEnd: "2026-01",
    });
  });
});

describe("rangeLabel", () => {
  it("returns the human-readable label for each preset", () => {
    expect(rangeLabel("this-month")).toBe("This month");
    expect(rangeLabel("last-month")).toBe("Last month");
    expect(rangeLabel("last-3-months")).toBe("Last 3 months");
    expect(rangeLabel("ytd")).toBe("YTD");
    expect(rangeLabel("last-12-months")).toBe("Last 12 months");
  });
});

describe("isRangePreset", () => {
  it("accepts every preset", () => {
    expect(isRangePreset("this-month")).toBe(true);
    expect(isRangePreset("ytd")).toBe(true);
  });

  it("rejects unknown strings and non-strings", () => {
    expect(isRangePreset("forever")).toBe(false);
    expect(isRangePreset(undefined)).toBe(false);
    expect(isRangePreset(null)).toBe(false);
    expect(isRangePreset(7)).toBe(false);
  });
});

describe("signed amounts flow through aggregations", () => {
  // Chunk 4 makes Transaction.amount signed end-to-end. These tests verify
  // every aggregation seam already nets signed values rather than treating
  // them as absolute. A refund/withdrawal scenario is the canonical case.
  const groc = expenseCat({ id: "groc" });

  it("monthTotalsByCategory nets a refund against the same-month purchase", () => {
    const txs: Transaction[] = [
      { id: "1", categoryId: "groc", amount: 200, date: "2026-06-01" },
      { id: "2", categoryId: "groc", amount: -50, date: "2026-06-10" }, // refund
    ];
    const totals = monthTotalsByCategory(txs, [groc], "2026-06");
    expect(totals.get("groc")).toBe(150);
  });

  it("monthTotalsByCategory allows a net-negative month (refund > spend)", () => {
    const txs: Transaction[] = [
      { id: "1", categoryId: "groc", amount: 30, date: "2026-06-01" },
      { id: "2", categoryId: "groc", amount: -100, date: "2026-06-15" },
    ];
    const totals = monthTotalsByCategory(txs, [groc], "2026-06");
    expect(totals.get("groc")).toBe(-70);
  });

  it("ytdTotalsByCategory subtracts an in-year refund from the gross", () => {
    const txs: Transaction[] = [
      { id: "1", categoryId: "groc", amount: 400, date: "2026-03-15" },
      { id: "2", categoryId: "groc", amount: -75, date: "2026-05-20" }, // refund
    ];
    const today = new Date("2026-06-08T00:00:00Z");
    const totals = ytdTotalsByCategory(txs, [groc], today);
    expect(totals.get("groc")).toBe(325);
  });

  it("monthlyTotalsLastN returns the signed net per month", () => {
    const txs: Transaction[] = [
      { id: "1", categoryId: "hysa", amount: 500, date: "2026-04-15" },
      { id: "2", categoryId: "hysa", amount: 500, date: "2026-05-15" },
      // June: net -100 (deposit then larger withdrawal).
      { id: "3", categoryId: "hysa", amount: 200, date: "2026-06-01" },
      { id: "4", categoryId: "hysa", amount: -300, date: "2026-06-20" },
    ];
    const today = new Date("2026-06-08T00:00:00Z");
    const series = monthlyTotalsLastN(txs, "hysa", 3, today);
    expect(series).toEqual([
      { ym: "2026-04", total: 500 },
      { ym: "2026-05", total: 500 },
      { ym: "2026-06", total: -100 },
    ]);
  });
});

describe("signLabelsFor", () => {
  it.each([
    { kind: "expense" as const, positive: "Spent", negative: "Refunded" },
    { kind: "savings" as const, positive: "Deposit", negative: "Withdraw" },
    { kind: "income" as const, positive: "Received", negative: "Reversed" },
  ])("maps $kind to {$positive, $negative}", ({ kind, positive, negative }) => {
    expect(signLabelsFor(kind)).toEqual({ positive, negative });
  });
});

describe("mostRecentTransactionInCategory", () => {
  const txs: Transaction[] = [
    { id: "a", categoryId: "groc", amount: 10, date: "2026-05-01" },
    { id: "b", categoryId: "groc", amount: 20, date: "2026-06-04" },
    { id: "c", categoryId: "groc", amount: 30, date: "2026-04-15" },
    { id: "d", categoryId: "hysa", amount: 800, date: "2026-06-10" },
  ];

  it("returns the latest by date for a category", () => {
    expect(mostRecentTransactionInCategory(txs, "groc")?.id).toBe("b");
  });

  it("isolates by category", () => {
    expect(mostRecentTransactionInCategory(txs, "hysa")?.id).toBe("d");
  });

  it("returns undefined when the category has no transactions", () => {
    expect(mostRecentTransactionInCategory(txs, "rent")).toBeUndefined();
  });

  it("breaks same-date ties deterministically by id (lexicographic, max wins)", () => {
    const sameDay: Transaction[] = [
      { id: "z", categoryId: "groc", amount: 10, date: "2026-06-04" },
      { id: "a", categoryId: "groc", amount: 20, date: "2026-06-04" },
      { id: "m", categoryId: "groc", amount: 30, date: "2026-06-04" },
    ];
    expect(mostRecentTransactionInCategory(sameDay, "groc")?.id).toBe("z");
  });
});

describe("vendorSuggestionsForCategory", () => {
  const txs: Transaction[] = [
    { id: "1", categoryId: "groc", amount: 10, date: "2026-06-01", vendor: "Whole Foods" },
    { id: "2", categoryId: "groc", amount: 12, date: "2026-06-02", vendor: "Whole Foods" },
    { id: "3", categoryId: "groc", amount: 14, date: "2026-06-03", vendor: "Trader Joe's" },
    { id: "4", categoryId: "dining", amount: 50, date: "2026-06-04", vendor: "Sushi Ran" },
    { id: "5", categoryId: "dining", amount: 30, date: "2026-06-05", vendor: "Sushi Ran" },
    { id: "6", categoryId: "dining", amount: 25, date: "2026-06-06", vendor: "Whole Foods" }, // cross-category
    { id: "7", categoryId: "groc", amount: 16, date: "2026-06-07" }, // no vendor — dropped
    { id: "8", categoryId: "groc", amount: 18, date: "2026-06-08", vendor: "  " }, // blank — dropped
  ];

  it("ranks vendors used in the active category first by frequency, then globals", () => {
    expect(vendorSuggestionsForCategory(txs, "groc")).toEqual([
      "Whole Foods",
      "Trader Joe's",
      "Sushi Ran",
    ]);
  });

  it("returns globals only when the category is empty", () => {
    expect(vendorSuggestionsForCategory(txs, "rent")).toEqual([
      "Whole Foods",
      "Sushi Ran",
      "Trader Joe's",
    ]);
  });

  it("breaks frequency ties alphabetically for stable ordering", () => {
    const tied: Transaction[] = [
      { id: "1", categoryId: "groc", amount: 5, date: "2026-06-01", vendor: "Whole Foods" },
      { id: "2", categoryId: "groc", amount: 5, date: "2026-06-02", vendor: "Aldi" },
    ];
    expect(vendorSuggestionsForCategory(tied, "groc")).toEqual(["Aldi", "Whole Foods"]);
  });
});

describe("matchesTransactionFilter", () => {
  const t: Transaction = {
    id: "1",
    categoryId: "groc",
    amount: 12.5,
    date: "2026-06-05",
    vendor: "Whole Foods",
    note: "Weekly run",
  };

  it("returns true when the filter is empty", () => {
    expect(matchesTransactionFilter(t, {})).toBe(true);
  });

  it("matches free-text against vendor case-insensitively", () => {
    expect(matchesTransactionFilter(t, { text: "whole" })).toBe(true);
    expect(matchesTransactionFilter(t, { text: "WHOLE" })).toBe(true);
  });

  it("matches free-text against note case-insensitively", () => {
    expect(matchesTransactionFilter(t, { text: "weekly" })).toBe(true);
  });

  it("rejects free-text that matches neither vendor nor note", () => {
    expect(matchesTransactionFilter(t, { text: "costco" })).toBe(false);
  });

  it("treats whitespace-only free-text as 'no filter'", () => {
    expect(matchesTransactionFilter(t, { text: "   " })).toBe(true);
  });

  it("ignores missing vendor / note when the text filter is empty", () => {
    const bare: Transaction = { id: "2", categoryId: "groc", amount: 5, date: "2026-06-06" };
    expect(matchesTransactionFilter(bare, {})).toBe(true);
    expect(matchesTransactionFilter(bare, { text: "anything" })).toBe(false);
  });

  it("filters by exact vendor", () => {
    expect(matchesTransactionFilter(t, { vendor: "Whole Foods" })).toBe(true);
    expect(matchesTransactionFilter(t, { vendor: "Trader Joe's" })).toBe(false);
  });

  it("treats empty vendor as 'all vendors'", () => {
    expect(matchesTransactionFilter(t, { vendor: "" })).toBe(true);
  });

  it("enforces inclusive dateFrom / dateTo bounds", () => {
    expect(matchesTransactionFilter(t, { dateFrom: "2026-06-05" })).toBe(true);
    expect(matchesTransactionFilter(t, { dateFrom: "2026-06-06" })).toBe(false);
    expect(matchesTransactionFilter(t, { dateTo: "2026-06-05" })).toBe(true);
    expect(matchesTransactionFilter(t, { dateTo: "2026-06-04" })).toBe(false);
  });

  it("filters by category membership (global multi-select)", () => {
    expect(matchesTransactionFilter(t, { categoryIds: ["groc"] })).toBe(true);
    expect(matchesTransactionFilter(t, { categoryIds: ["rent", "groc"] })).toBe(true);
    expect(matchesTransactionFilter(t, { categoryIds: ["rent"] })).toBe(false);
  });

  it("treats an empty categoryIds list as 'all categories'", () => {
    expect(matchesTransactionFilter(t, { categoryIds: [] })).toBe(true);
  });

  it("combines all filters as AND", () => {
    expect(
      matchesTransactionFilter(t, {
        text: "weekly",
        vendor: "Whole Foods",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      }),
    ).toBe(true);
    // Vendor mismatch alone is enough to fail.
    expect(
      matchesTransactionFilter(t, {
        text: "weekly",
        vendor: "Trader Joe's",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      }),
    ).toBe(false);
  });
});
