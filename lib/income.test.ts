import { describe, expect, it } from "vitest";
import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import {
  buildIncomeSourceDisplayLabel,
  cadenceLabel,
  classifyIncomeSourceStatus,
  monthlyFromCadence,
  monthlyToYearly,
  nextScheduledTarget,
  oneTimeReceiptSummary,
  paychecksInMonth,
  paychecksThroughDate,
  perPaycheckFromMonthly,
  yearlyToMonthly,
} from "./income";

const incomeCat = (overrides: Partial<Category> = {}): Category => ({
  id: "salary",
  name: "Salary",
  emoji: "💼",
  kind: "income",
  activeFrom: "2026-01",
  ...overrides,
});

describe("classifyIncomeSourceStatus", () => {
  it("returns 'active' for a source with no targets", () => {
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", [])).toBe("active");
  });

  it("returns 'active' when the only target is past-effective (the current baseline)", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe("active");
  });

  it("treats a target effective at the current month as the current baseline, not scheduled", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 8000, effectiveFrom: "2026-06" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe("active");
  });

  it("returns 'scheduled-change' when a target is effective next month", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
      { categoryId: "salary", monthly: 8500, effectiveFrom: "2026-07" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe(
      "scheduled-change",
    );
  });

  it("returns 'ended' when activeUntil equals the current month", () => {
    const ended = incomeCat({ activeUntil: "2026-06" });
    expect(classifyIncomeSourceStatus(ended, "2026-06", [])).toBe("ended");
  });

  it("returns 'ended' when activeUntil is in the past", () => {
    const ended = incomeCat({ activeUntil: "2026-03" });
    expect(classifyIncomeSourceStatus(ended, "2026-06", [])).toBe("ended");
  });

  it("returns 'active' when activeUntil is still in the future", () => {
    const futureBound = incomeCat({ activeUntil: "2026-12" });
    expect(classifyIncomeSourceStatus(futureBound, "2026-06", [])).toBe("active");
  });

  it("prefers 'ended' over 'scheduled-change' when both conditions are met", () => {
    const ended = incomeCat({ activeUntil: "2026-06" });
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 9000, effectiveFrom: "2026-08" },
    ];
    expect(classifyIncomeSourceStatus(ended, "2026-06", targets)).toBe("ended");
  });

  it("ignores target rows that belong to other categories", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "bonus", monthly: 5000, effectiveFrom: "2026-08" },
    ];
    expect(classifyIncomeSourceStatus(incomeCat(), "2026-06", targets)).toBe("active");
  });
});

describe("buildIncomeSourceDisplayLabel", () => {
  it("returns the bare name when no other source shares it", () => {
    const salary = incomeCat({ id: "salary", name: "Salary" });
    const bonus = incomeCat({ id: "bonus", name: "Bonus" });
    expect(buildIncomeSourceDisplayLabel(salary, [salary, bonus], "active")).toBe(
      "Salary",
    );
  });

  it("suffixes both rows when two active sources share a name", () => {
    const a = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const b = incomeCat({ id: "b", name: "Bonus", activeFrom: "2026-05" });
    expect(buildIncomeSourceDisplayLabel(a, [a, b], "active")).toBe(
      "Bonus · since January 2026",
    );
    expect(buildIncomeSourceDisplayLabel(b, [a, b], "active")).toBe(
      "Bonus · since May 2026",
    );
  });

  it("suffixes an active row with 'scheduled change' when colliding with an ended row", () => {
    const scheduled = incomeCat({ id: "a", name: "Bonus" });
    const ended = incomeCat({
      id: "b",
      name: "Bonus",
      activeFrom: "2025-01",
      activeUntil: "2026-06",
    });
    expect(
      buildIncomeSourceDisplayLabel(scheduled, [scheduled, ended], "scheduled-change"),
    ).toBe("Bonus · scheduled change");
    expect(buildIncomeSourceDisplayLabel(ended, [scheduled, ended], "ended")).toBe(
      "Bonus · ended June 2026",
    );
  });

  it("detects case-insensitive collisions", () => {
    const upper = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const lower = incomeCat({ id: "b", name: "bonus", activeFrom: "2026-03" });
    expect(buildIncomeSourceDisplayLabel(upper, [upper, lower], "active")).toBe(
      "Bonus · since January 2026",
    );
    expect(buildIncomeSourceDisplayLabel(lower, [upper, lower], "active")).toBe(
      "bonus · since March 2026",
    );
  });

  it("treats leading/trailing whitespace as part of the same normalized name and renders the trimmed name", () => {
    const trimmed = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const padded = incomeCat({ id: "b", name: "  Bonus  ", activeFrom: "2026-03" });
    expect(buildIncomeSourceDisplayLabel(trimmed, [trimmed, padded], "active")).toBe(
      "Bonus · since January 2026",
    );
    // Padded side renders with trimmed name too — no `"  Bonus   · since March 2026"`.
    expect(buildIncomeSourceDisplayLabel(padded, [trimmed, padded], "active")).toBe(
      "Bonus · since March 2026",
    );
  });

  it("trims surrounding whitespace from the bare-name path too", () => {
    const padded = incomeCat({ id: "a", name: "  Salary  " });
    expect(buildIncomeSourceDisplayLabel(padded, [padded], "active")).toBe("Salary");
  });

  it("handles three-way collisions by suffixing every colliding row", () => {
    const active = incomeCat({ id: "a", name: "Bonus", activeFrom: "2026-01" });
    const scheduled = incomeCat({ id: "b", name: "Bonus", activeFrom: "2026-04" });
    const ended = incomeCat({
      id: "c",
      name: "Bonus",
      activeFrom: "2025-01",
      activeUntil: "2026-03",
    });
    const all = [active, scheduled, ended];
    expect(buildIncomeSourceDisplayLabel(active, all, "active")).toBe(
      "Bonus · since January 2026",
    );
    expect(buildIncomeSourceDisplayLabel(scheduled, all, "scheduled-change")).toBe(
      "Bonus · scheduled change",
    );
    expect(buildIncomeSourceDisplayLabel(ended, all, "ended")).toBe(
      "Bonus · ended March 2026",
    );
  });

  it("ignores the source itself when checking for collisions", () => {
    const only = incomeCat({ id: "a", name: "Bonus" });
    expect(buildIncomeSourceDisplayLabel(only, [only], "active")).toBe("Bonus");
  });
});

describe("nextScheduledTarget", () => {
  it("returns undefined when there are no future-effective targets", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
      { categoryId: "salary", monthly: 8000, effectiveFrom: "2026-06" },
    ];
    expect(nextScheduledTarget("salary", "2026-06", targets)).toBeUndefined();
  });

  it("returns the soonest future-effective row", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 7500, effectiveFrom: "2026-01" },
      { categoryId: "salary", monthly: 9000, effectiveFrom: "2026-09" },
      { categoryId: "salary", monthly: 8500, effectiveFrom: "2026-07" },
    ];
    expect(nextScheduledTarget("salary", "2026-06", targets)).toEqual({
      categoryId: "salary",
      monthly: 8500,
      effectiveFrom: "2026-07",
    });
  });

  it("treats a target effective at the current month as the current baseline (not scheduled)", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "salary", monthly: 8000, effectiveFrom: "2026-06" },
    ];
    expect(nextScheduledTarget("salary", "2026-06", targets)).toBeUndefined();
  });

  it("ignores rows for other categories", () => {
    const targets: CategoryTarget[] = [
      { categoryId: "bonus", monthly: 1000, effectiveFrom: "2026-07" },
    ];
    expect(nextScheduledTarget("salary", "2026-06", targets)).toBeUndefined();
  });
});

describe("monthlyToYearly / yearlyToMonthly", () => {
  it("annualizes a monthly amount", () => {
    expect(monthlyToYearly(10000)).toBe(120000);
  });

  it("rounds float-drift to cents so a stored $100k reads back clean", () => {
    // $100,000/yr stored as 8333.333…/mo must round-trip to 100000, not
    // 99999.99999999999.
    expect(monthlyToYearly(100000 / 12)).toBe(100000);
  });

  it("converts a yearly amount to its monthly average", () => {
    expect(yearlyToMonthly(120000)).toBe(10000);
  });

  it("is the inverse of monthlyToYearly within cent precision", () => {
    expect(monthlyToYearly(yearlyToMonthly(90000))).toBe(90000);
  });
});

describe("monthlyFromCadence", () => {
  it("converts each cadence to its monthly average", () => {
    expect(monthlyFromCadence(600, "weekly")).toBe(2600); // 600 × 52 / 12
    expect(monthlyFromCadence(600, "bi-weekly")).toBe(1300); // 600 × 26 / 12
    expect(monthlyFromCadence(600, "semi-monthly")).toBe(1200); // 600 × 24 / 12
    expect(monthlyFromCadence(5000, "monthly")).toBe(5000); // pass-through
  });

  it("recovers the $7,500/mo baseline from the $90k/yr bi-weekly headline example", () => {
    // $90,000/yr paid bi-weekly is $3,461.54/check; the stored monthly must be
    // exactly $7,500 (90000 / 12), not float-drift.
    expect(monthlyFromCadence(90000 / 26, "bi-weekly")).toBeCloseTo(7500, 6);
  });
});

describe("oneTimeReceiptSummary", () => {
  const tx = (o: Partial<Transaction> = {}): Transaction => ({
    id: "t",
    categoryId: "rsu",
    amount: 1000,
    date: "2026-03-15",
    ...o,
  });

  it("sums this year's receipts and reports the latest as the last receipt", () => {
    const summary = oneTimeReceiptSummary(
      [
        tx({ id: "a", amount: 12500, date: "2026-03-15", note: "Q1 vest" }),
        tx({ id: "b", amount: 12500, date: "2026-06-15", note: "Q2 vest" }),
      ],
      "rsu",
      "2026",
    );
    expect(summary.received).toBe(25000);
    expect(summary.last).toEqual({ date: "2026-06-15", noun: "vest" });
  });

  it("derives the noun from vendor/note, defaulting to 'receipt'", () => {
    expect(
      oneTimeReceiptSummary([tx({ note: "annual bonus" })], "rsu", "2026").last
        ?.noun,
    ).toBe("bonus");
    expect(
      oneTimeReceiptSummary(
        [tx({ vendor: "Morgan Stanley", note: "RSU vest" })],
        "rsu",
        "2026",
      ).last?.noun,
    ).toBe("vest");
    expect(
      oneTimeReceiptSummary([tx({ vendor: "Acme", note: "" })], "rsu", "2026")
        .last?.noun,
    ).toBe("receipt");
  });

  it("returns an empty summary when there are no receipts this year", () => {
    expect(oneTimeReceiptSummary([], "rsu", "2026")).toEqual({
      received: 0,
      last: null,
    });
  });

  it("excludes other years — a prior-year-only source reads as awaiting (story 15)", () => {
    expect(
      oneTimeReceiptSummary(
        [tx({ date: "2025-11-01", amount: 9000 })],
        "rsu",
        "2026",
      ),
    ).toEqual({ received: 0, last: null });
  });

  it("nets signed amounts, but a fully-reversed receipt still counts as received", () => {
    const summary = oneTimeReceiptSummary(
      [
        tx({ id: "a", amount: 5000, date: "2026-02-01", note: "vest" }),
        tx({ id: "b", amount: -5000, date: "2026-02-10", note: "vest reversed" }),
      ],
      "rsu",
      "2026",
    );
    expect(summary.received).toBe(0);
    expect(summary.last).not.toBeNull(); // not the empty state
    expect(summary.last?.date).toBe("2026-02-10");
  });

  it("ignores transactions for other categories", () => {
    expect(
      oneTimeReceiptSummary(
        [tx({ categoryId: "salary", amount: 8000 })],
        "rsu",
        "2026",
      ),
    ).toEqual({ received: 0, last: null });
  });

  it("breaks a same-date tie by id, inheriting mostRecentTransactionInCategory", () => {
    // Same date, supplied lowest-id-last to prove the winner isn't array order:
    // the higher id ("v2") wins, so its note drives the noun.
    const summary = oneTimeReceiptSummary(
      [
        tx({ id: "v2", amount: 2000, date: "2026-04-01", note: "spot bonus" }),
        tx({ id: "v1", amount: 1000, date: "2026-04-01", note: "RSU vest" }),
      ],
      "rsu",
      "2026",
    );
    expect(summary.received).toBe(3000);
    expect(summary.last).toEqual({ date: "2026-04-01", noun: "bonus" });
  });
});

describe("perPaycheckFromMonthly", () => {
  it("recovers the per-paycheck amount from a stored monthly baseline", () => {
    expect(perPaycheckFromMonthly(2600, "weekly")).toBeCloseTo(600, 6); // 2600 × 12 / 52
    expect(perPaycheckFromMonthly(1200, "semi-monthly")).toBeCloseTo(600, 6); // 1200 × 12 / 24
    expect(perPaycheckFromMonthly(5000, "monthly")).toBe(5000); // pass-through
  });

  it("turns the $7,500/mo salary into the $3,461.54 bi-weekly headline figure", () => {
    expect(perPaycheckFromMonthly(7500, "bi-weekly")).toBeCloseTo(3461.54, 2);
  });

  it("is the inverse of monthlyFromCadence for every cadence", () => {
    for (const cadence of [
      "weekly",
      "bi-weekly",
      "semi-monthly",
      "monthly",
    ] as const) {
      expect(
        perPaycheckFromMonthly(monthlyFromCadence(600, cadence), cadence),
      ).toBeCloseTo(600, 6);
    }
  });
});

describe("cadenceLabel", () => {
  it("returns the human display name for each cadence", () => {
    expect(cadenceLabel("weekly")).toBe("weekly");
    expect(cadenceLabel("bi-weekly")).toBe("bi-weekly");
    expect(cadenceLabel("semi-monthly")).toBe("semi-monthly");
    expect(cadenceLabel("monthly")).toBe("monthly");
  });
});

describe("paychecksInMonth", () => {
  it("monthly is always one per month", () => {
    expect(paychecksInMonth("monthly", "2026-02")).toBe(1);
    expect(paychecksInMonth("monthly", "2026-07")).toBe(1);
  });

  it("semi-monthly is always two (1st and 15th)", () => {
    expect(paychecksInMonth("semi-monthly", "2026-02")).toBe(2);
    expect(paychecksInMonth("semi-monthly", "2026-12")).toBe(2);
  });

  it("weekly yields 5 in a month the weekday recurs five times, 4 otherwise", () => {
    // Anchor Fri 2026-01-02: Jan has paydays 2,9,16,23,30 (5); Feb has 6,13,20,27 (4).
    expect(paychecksInMonth("weekly", "2026-01", "2026-01-02")).toBe(5);
    expect(paychecksInMonth("weekly", "2026-02", "2026-01-02")).toBe(4);
  });

  it("bi-weekly yields 3 in a third-stride month, 2 otherwise", () => {
    // Anchor 2026-01-02: Jan has 2,16,30 (3); Feb has 13,27 (2).
    expect(paychecksInMonth("bi-weekly", "2026-01", "2026-01-02")).toBe(3);
    expect(paychecksInMonth("bi-weekly", "2026-02", "2026-01-02")).toBe(2);
  });

  it("defaults the anchor to the first of the month when none is given", () => {
    // Period-7 from the 1st: Jan 1,8,15,22,29 = 5 in a 31-day month.
    expect(paychecksInMonth("weekly", "2026-01")).toBe(5);
  });

  it("sums to 27 over the bi-weekly 27-paycheck year, 26 in an ordinary year", () => {
    const months = Array.from(
      { length: 12 },
      (_, i) => `2026-${String(i + 1).padStart(2, "0")}`,
    );
    // Anchor Jan 1: paydays at Jan1 + 14k land on Dec 31 (day 364), giving 27.
    const sum27 = months.reduce(
      (n, ym) => n + paychecksInMonth("bi-weekly", ym, "2026-01-01"),
      0,
    );
    expect(sum27).toBe(27);
    // Anchor Jan 8: the final stride falls in Jan 2027, so 2026 sees only 26.
    const sum26 = months.reduce(
      (n, ym) => n + paychecksInMonth("bi-weekly", ym, "2026-01-08"),
      0,
    );
    expect(sum26).toBe(26);
  });
});

describe("paychecksThroughDate", () => {
  it("counts only paychecks on or before throughDate within the month", () => {
    // Weekly anchor 2026-01-02: through the 15th counts Jan 2 and 9 only.
    expect(paychecksThroughDate("weekly", "2026-01", "2026-01-15", "2026-01-02")).toBe(2);
    expect(paychecksThroughDate("weekly", "2026-01", "2026-01-31", "2026-01-02")).toBe(5);
  });

  it("counts the 1st inclusively on the first of the month", () => {
    // Semi-monthly through the 1st counts the 1st's paycheck (story 9: a
    // paycheck that lands on the 1st is received, not pending).
    expect(paychecksThroughDate("semi-monthly", "2026-03", "2026-03-01", "2026-03-01")).toBe(1);
    expect(paychecksThroughDate("semi-monthly", "2026-03", "2026-03-14", "2026-03-01")).toBe(1);
    expect(paychecksThroughDate("semi-monthly", "2026-03", "2026-03-15", "2026-03-01")).toBe(2);
  });

  it("returns zero when throughDate precedes the month", () => {
    expect(paychecksThroughDate("bi-weekly", "2026-02", "2026-01-20", "2026-01-02")).toBe(0);
  });

  it("counts the whole month when throughDate is past month-end", () => {
    expect(paychecksThroughDate("bi-weekly", "2026-02", "2026-12-31", "2026-01-02")).toBe(
      paychecksInMonth("bi-weekly", "2026-02", "2026-01-02"),
    );
  });

  it("clamps a monthly anchor's day-of-month to the month length", () => {
    // A 31st anchor pays on Feb 28; through the 27th nothing has landed yet.
    expect(paychecksThroughDate("monthly", "2026-02", "2026-02-28", "2026-01-31")).toBe(1);
    expect(paychecksThroughDate("monthly", "2026-02", "2026-02-27", "2026-01-31")).toBe(0);
  });
});
