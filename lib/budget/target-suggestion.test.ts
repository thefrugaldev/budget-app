import { describe, expect, it } from "vitest";

import type { Category, CategoryTarget, Transaction } from "@/types/budget";
import type { TargetSuggestionDismissal } from "@/types/target-suggestion";

import { proposeTargetFromMedian, selectTargetSuggestions } from "./target-suggestion";

describe("proposeTargetFromMedian — friendly round-up", () => {
  it("rounds up to the nearest $5 under $100", () => {
    expect(proposeTargetFromMedian(86)).toBe(90);
    expect(proposeTargetFromMedian(91)).toBe(95);
    expect(proposeTargetFromMedian(1)).toBe(5);
  });

  it("rounds up to the nearest $10 from $100 up to (not incl.) $250", () => {
    expect(proposeTargetFromMedian(145)).toBe(150);
    expect(proposeTargetFromMedian(151)).toBe(160);
    expect(proposeTargetFromMedian(100)).toBe(100);
  });

  it("rounds up to the nearest $25 from $250 up to (not incl.) $1,000", () => {
    expect(proposeTargetFromMedian(612)).toBe(625);
    expect(proposeTargetFromMedian(626)).toBe(650);
    expect(proposeTargetFromMedian(251)).toBe(275);
  });

  it("rounds up to the nearest $50 at $1,000 and above", () => {
    expect(proposeTargetFromMedian(1010)).toBe(1050);
    expect(proposeTargetFromMedian(2333)).toBe(2350);
    expect(proposeTargetFromMedian(3001)).toBe(3050);
  });

  it("keeps the top $50 band open-ended at large magnitudes", () => {
    expect(proposeTargetFromMedian(100000)).toBe(100000);
    expect(proposeTargetFromMedian(100013)).toBe(100050);
  });

  it("does not let the epsilon collapse a value sitting just above an increment", () => {
    // 90.5 is above the $90 increment and must round up to $95, not be pulled
    // back to $90 — the epsilon only absorbs float error at the increment.
    expect(proposeTargetFromMedian(90.5)).toBe(95);
    expect(proposeTargetFromMedian(150.01)).toBe(160);
  });

  it("chooses the band from the input figure, then rounds up across boundaries", () => {
    // 98 is in the sub-$100 ($5) band and rounds up onto the $100 boundary.
    expect(proposeTargetFromMedian(98)).toBe(100);
    // 249 is in the sub-$250 ($10) band and rounds up onto $250.
    expect(proposeTargetFromMedian(249)).toBe(250);
    // 990 is in the sub-$1,000 ($25) band and rounds up onto $1,000.
    expect(proposeTargetFromMedian(990)).toBe(1000);
  });

  it("returns a figure already on its increment unchanged", () => {
    expect(proposeTargetFromMedian(85)).toBe(85);
    expect(proposeTargetFromMedian(150)).toBe(150);
    expect(proposeTargetFromMedian(625)).toBe(625);
    expect(proposeTargetFromMedian(250)).toBe(250);
    expect(proposeTargetFromMedian(1000)).toBe(1000);
  });

  it("rounds fractional cents up to the friendly increment", () => {
    expect(proposeTargetFromMedian(87.3)).toBe(90);
    expect(proposeTargetFromMedian(612.5)).toBe(625);
    expect(proposeTargetFromMedian(1000.01)).toBe(1050);
  });

  it("yields 0 for a non-positive median (no sensible friendly cap)", () => {
    expect(proposeTargetFromMedian(0)).toBe(0);
    expect(proposeTargetFromMedian(-40)).toBe(0);
  });
});

// now = mid-August 2026 → current (in-progress) month "2026-08", so the six
// complete evidence months are Feb–Jul 2026.
const NOW = new Date("2026-08-15T12:00:00Z");
const WINDOW = ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"] as const;

function expenseCat(id: string, over: Partial<Category> = {}): Category {
  return { id, name: id, kind: "expense", activeFrom: "2020-01", ...over };
}

function target(categoryId: string, monthly: number, effectiveFrom = "2020-01"): CategoryTarget {
  return { categoryId, monthly, effectiveFrom };
}

/** One transaction per window month, amounts given oldest-first (Feb→Jul). */
function monthlyTxns(categoryId: string, amounts: number[], imported = false): Transaction[] {
  return amounts.map((amount, i) => ({
    id: `${categoryId}-${i}`,
    categoryId,
    amount,
    date: `${WINDOW[i]}-15`,
    imported,
  }));
}

describe("selectTargetSuggestions — triggers", () => {
  it("fires a raise when a cap is sustainably exceeded, with a friendly-rounded proposal", () => {
    // Six months all over a $1,000 cap; median 1,330 → rounds up to 1,350.
    const cats = [expenseCat("daycare")];
    const targets = [target("daycare", 1000)];
    const txns = monthlyTxns("daycare", [1280, 1300, 1320, 1340, 1360, 1380]);

    const [s] = selectTargetSuggestions(cats, txns, targets, [], NOW);
    expect(s).toMatchObject({
      categoryId: "daycare",
      kind: "expense",
      direction: "raise",
      currentTarget: 1000,
      median: 1330,
      proposedTarget: 1350,
      impact: 350,
    });
  });

  it("fires a lower suggestion when spend sustainably drops below the cap (e.g. a car payoff)", () => {
    const cats = [expenseCat("car")];
    const targets = [target("car", 800)];
    const txns = monthlyTxns("car", [480, 500, 500, 500, 520, 500]);

    const [s] = selectTargetSuggestions(cats, txns, targets, [], NOW);
    expect(s).toMatchObject({
      categoryId: "car",
      direction: "lower",
      currentTarget: 800,
      median: 500,
      proposedTarget: 500,
      impact: 300,
    });
  });

  it("does not fire on a single outlier month (persistence guard)", () => {
    // Five at-cap months + one blowout: only 1 month is 'over', below quorum.
    const cats = [expenseCat("groceries")];
    const targets = [target("groceries", 500)];
    const txns = monthlyTxns("groceries", [500, 500, 500, 500, 500, 1500]);

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("does not fire when the median gap is under 15% of the cap", () => {
    const cats = [expenseCat("utilities")];
    const targets = [target("utilities", 1000)];
    const txns = monthlyTxns("utilities", [1100, 1100, 1100, 1100, 1100, 1100]); // +10%

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("does not fire when the median gap is under $25/mo (even if ≥15%)", () => {
    const cats = [expenseCat("streaming")];
    const targets = [target("streaming", 100)];
    const txns = monthlyTxns("streaming", [120, 120, 120, 120, 120, 120]); // +20% but only +$20

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("pins the persistence quorum at 5 of 6 (4-over is silent, 5-over fires)", () => {
    const cats = [expenseCat("daycare")];
    const targets = [target("daycare", 1000)];
    // 4 over + 2 at-cap (neutral) → quorum not met.
    const four = monthlyTxns("daycare", [1300, 1300, 1300, 1300, 1000, 1000]);
    expect(selectTargetSuggestions(cats, four, targets, [], NOW)).toEqual([]);
    // 5 over + 1 at-cap → quorum met.
    const five = monthlyTxns("daycare", [1300, 1300, 1300, 1300, 1300, 1000]);
    expect(selectTargetSuggestions(cats, five, targets, [], NOW)).toHaveLength(1);
  });

  it("does not fire for a lumpy category whose months scatter across the cap", () => {
    // Annual-insurance shape: alternating $0 and big months — 3 over, 3 under.
    const cats = [expenseCat("insurance")];
    const targets = [target("insurance", 200)];
    const txns = monthlyTxns("insurance", [0, 600, 0, 500, 0, 400]);

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("counts imported transactions, so seven years of archive history feeds suggestions", () => {
    const cats = [expenseCat("mortgage")];
    const targets = [target("mortgage", 2000)];
    const txns = monthlyTxns("mortgage", [2400, 2400, 2400, 2400, 2400, 2400], true);

    const [s] = selectTargetSuggestions(cats, txns, targets, [], NOW);
    expect(s?.direction).toBe("raise");
    expect(s?.proposedTarget).toBe(2400);
  });
});

describe("selectTargetSuggestions — eligibility", () => {
  it("stays silent when the cap changed inside the window (stability guard, story 16)", () => {
    const cats = [expenseCat("daycare")];
    // Cap set effective May 2026 — inside the Feb–Jul window.
    const targets = [target("daycare", 1000, "2026-05")];
    const txns = monthlyTxns("daycare", [1300, 1300, 1300, 1300, 1300, 1300]);

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("stays silent for a future-dated cap change (a just-accepted suggestion goes quiet)", () => {
    const cats = [expenseCat("daycare")];
    const targets = [
      target("daycare", 1000, "2020-01"),
      target("daycare", 1350, "2026-09"), // accepted, effective next month
    ];
    const txns = monthlyTxns("daycare", [1300, 1300, 1300, 1300, 1300, 1300]);

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("ignores an ended category (story 17)", () => {
    const cats = [expenseCat("daycare", { activeUntil: "2026-06" })];
    const targets = [target("daycare", 1000)];
    const txns = monthlyTxns("daycare", [1300, 1300, 1300, 1300, 1300, 1300]);

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("ignores an unbudgeted ($0 cap) category (story 17)", () => {
    const cats = [expenseCat("misc")];
    const txns = monthlyTxns("misc", [300, 300, 300, 300, 300, 300]);

    expect(selectTargetSuggestions(cats, txns, [], [], NOW)).toEqual([]);
  });

  it("ignores a too-young category (cap first effective inside the window)", () => {
    const cats = [expenseCat("newbie", { activeFrom: "2026-04" })];
    const targets = [target("newbie", 300, "2026-04")];
    const txns = monthlyTxns("newbie", [0, 0, 450, 450, 450, 450]);

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });

  it("ignores non-expense categories (v1 is expense-only)", () => {
    const cats: Category[] = [
      { id: "hysa", name: "HYSA", kind: "savings", activeFrom: "2020-01" },
    ];
    const targets = [target("hysa", 500)];
    const txns = monthlyTxns("hysa", [900, 900, 900, 900, 900, 900]);

    expect(selectTargetSuggestions(cats, txns, targets, [], NOW)).toEqual([]);
  });
});

describe("selectTargetSuggestions — ranking", () => {
  it("orders by dollar impact, largest change first", () => {
    const cats = [expenseCat("small"), expenseCat("big")];
    const targets = [target("small", 1000), target("big", 1000)];
    const txns = [
      ...monthlyTxns("small", [1200, 1200, 1200, 1200, 1200, 1200]), // impact 200
      ...monthlyTxns("big", [1500, 1500, 1500, 1500, 1500, 1500]), // impact 500
    ];

    const out = selectTargetSuggestions(cats, txns, targets, [], NOW);
    expect(out.map((s) => s.categoryId)).toEqual(["big", "small"]);
  });
});

describe("selectTargetSuggestions — dismissals", () => {
  const cats = [expenseCat("daycare")];
  const targets = [target("daycare", 1000)];
  const txns = monthlyTxns("daycare", [1300, 1300, 1300, 1300, 1300, 1300]); // median 1300

  function dismissal(over: Partial<TargetSuggestionDismissal> = {}): TargetSuggestionDismissal {
    return {
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
      dismissedAt: "2026-07-15T00:00:00Z",
      ...over,
    };
  }

  it("suppresses a still-firing suggestion inside the 3-month snooze (story 9)", () => {
    expect(selectTargetSuggestions(cats, txns, targets, [dismissal()], NOW)).toEqual([]);
  });

  it("re-surfaces once the snooze has elapsed and the trigger still fires (story 9)", () => {
    const old = dismissal({ dismissedAt: "2026-04-01T00:00:00Z" }); // >3 months ago
    const out = selectTargetSuggestions(cats, txns, targets, [old], NOW);
    expect(out.map((s) => s.categoryId)).toEqual(["daycare"]);
  });

  it("re-surfaces early when the median shifts another 15%/$25 further (story 10)", () => {
    // Dismissed at median 1300; now 1600 → +300 > 15% of 1300 (195).
    const worse = monthlyTxns("daycare", [1600, 1600, 1600, 1600, 1600, 1600]);
    const out = selectTargetSuggestions(cats, worse, targets, [dismissal()], NOW);
    expect(out.map((s) => s.categoryId)).toEqual(["daycare"]);
  });

  it("re-surfaces early when the divergence direction flips (story 10)", () => {
    // Dismissed a raise; spend has now dropped below the same cap → a lower.
    const flipped = monthlyTxns("daycare", [700, 700, 700, 700, 700, 700]);
    const out = selectTargetSuggestions(cats, flipped, targets, [dismissal()], NOW);
    expect(out[0]?.direction).toBe("lower");
  });

  it("clears the snooze month-grained, ignoring the dismissal day-of-month", () => {
    // Dismissed on the 31st: month-grained, May + 3 = Aug, and now is Aug → the
    // snooze has elapsed regardless of the day (guards the old day-overflow bug).
    const monthEnd = dismissal({ dismissedAt: "2026-05-31T00:00:00Z" });
    const out = selectTargetSuggestions(cats, txns, targets, [monthEnd], NOW);
    expect(out.map((s) => s.categoryId)).toEqual(["daycare"]);
  });

  it("ignores a stale dismissal recorded against a now-changed cap", () => {
    // Dismissal was measured against a $900 cap; the live cap is $1,000.
    const stale = dismissal({ dismissedAgainstTarget: 900 });
    const out = selectTargetSuggestions(cats, txns, targets, [stale], NOW);
    expect(out.map((s) => s.categoryId)).toEqual(["daycare"]);
  });
});
