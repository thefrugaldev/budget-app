import { describe, expect, it } from "vitest";
import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import {
  aggregateRange,
  computeSavingsRate,
  isCategoryActiveForMonth,
  monthTotalsByCategory,
  monthlyTotalsLastN,
  monthsInRange,
  resolveTargetForMonth,
  thresholdFor,
  ytdTotalsByCategory,
} from "./budget";

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
