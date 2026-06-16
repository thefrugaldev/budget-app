import { describe, expect, it } from "vitest";

import { groupTransactionsByDay } from "./transaction";
import type { Transaction } from "@/types/budget";

const tx = (overrides: Partial<Transaction> & Pick<Transaction, "id">): Transaction => ({
  categoryId: "groc",
  amount: 100,
  date: "2026-06-08",
  vendor: "Whole Foods",
  ...overrides,
});

// Fix `today` so `dayLabel` is deterministic across the suite. Pinned far from
// any test transaction date so no group accidentally becomes "Today" /
// "Yesterday" except in the test that explicitly checks for it.
const NOW = new Date("2027-01-01T00:00:00Z");
const opts = { today: NOW };

describe("groupTransactionsByDay", () => {
  it("returns [] for an empty list", () => {
    expect(groupTransactionsByDay([], opts)).toEqual([]);
  });

  it("groups a single transaction into one day with one SingleRow", () => {
    const t = tx({ id: "a" });
    const groups = groupTransactionsByDay([t], opts);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe("2026-06-08");
    expect(groups[0].subtotal).toBe(100);
    expect(groups[0].rows).toEqual([{ kind: "single", transaction: t }]);
  });

  it("orders day groups newest-first regardless of input order", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", date: "2026-06-08" }),
        tx({ id: "b", date: "2026-06-10" }),
        tx({ id: "c", date: "2026-06-09" }),
      ],
      opts,
    );
    expect(groups.map((g) => g.date)).toEqual([
      "2026-06-10",
      "2026-06-09",
      "2026-06-08",
    ]);
  });

  it("collapses a same-day (vendor, amount) run of ≥ 2 into a CollapsedStreak", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", amount: 87.42 }),
        tx({ id: "b", amount: 87.42 }),
        tx({ id: "c", amount: 87.42 }),
        tx({ id: "d", amount: 87.42 }),
      ],
      opts,
    );
    expect(groups[0].rows).toEqual([
      {
        kind: "streak",
        vendor: "Whole Foods",
        amount: 87.42,
        count: 4,
        transactionIds: ["a", "b", "c", "d"],
      },
    ]);
    expect(groups[0].subtotal).toBeCloseTo(349.68, 2);
  });

  it("leaves count-of-one rows as SingleRow", () => {
    const a = tx({ id: "a", vendor: "Whole Foods", amount: 50 });
    const b = tx({ id: "b", vendor: "Costco", amount: 50 });
    const groups = groupTransactionsByDay([a, b], opts);
    expect(groups[0].rows).toEqual([
      { kind: "single", transaction: a },
      { kind: "single", transaction: b },
    ]);
  });

  it("collapses a streak even when notes differ — note is not part of the key", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", amount: 87.42, note: "weekly stock-up" }),
        tx({ id: "b", amount: 87.42, note: "snacks for movie night" }),
        tx({ id: "c", amount: 87.42 }),
      ],
      opts,
    );
    const [row] = groups[0].rows;
    expect(row.kind).toBe("streak");
    expect((row as { count: number }).count).toBe(3);
    expect((row as { transactionIds: string[] }).transactionIds).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("nets purchases and refunds in the day subtotal", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", vendor: "Target", amount: 50 }),
        tx({ id: "b", vendor: "Target", amount: -10 }),
      ],
      opts,
    );
    expect(groups[0].subtotal).toBe(40);
    expect(groups[0].rows).toHaveLength(2); // (50) and (-10) are different amounts → no collapse
  });

  it("reports a negative subtotal for an all-refund day", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", vendor: "Target", amount: -10 }),
        tx({ id: "b", vendor: "Best Buy", amount: -25 }),
      ],
      opts,
    );
    expect(groups[0].subtotal).toBe(-35);
  });

  it("collapses refund streaks with negative signed amount", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", vendor: "Target", amount: -10 }),
        tx({ id: "b", vendor: "Target", amount: -10 }),
      ],
      opts,
    );
    expect(groups[0].rows).toEqual([
      {
        kind: "streak",
        vendor: "Target",
        amount: -10,
        count: 2,
        transactionIds: ["a", "b"],
      },
    ]);
    expect(groups[0].subtotal).toBe(-20);
  });

  it("respects a caller-applied date filter: in-range streak collapses on in-range count", () => {
    // 10-transaction streak originally; filter keeps only the 4 within range.
    // The helper sees the filtered list and collapses based on that count.
    const all: Transaction[] = Array.from({ length: 10 }, (_, i) =>
      tx({ id: `t${i}`, amount: 87.42, date: `2026-06-${String(i + 1).padStart(2, "0")}` }),
    );
    const inRange = all.filter(
      (t) => t.date >= "2026-06-03" && t.date <= "2026-06-06",
    );
    const groups = groupTransactionsByDay(inRange, opts);
    expect(groups).toHaveLength(4); // each transaction on a distinct day
    for (const g of groups) {
      // Each day has exactly one transaction → SingleRow, not a streak.
      expect(g.rows).toHaveLength(1);
      expect(g.rows[0].kind).toBe("single");
    }

    // Same-day streak whose count is cut by the filter.
    const sameDayStreak: Transaction[] = Array.from({ length: 10 }, (_, i) =>
      tx({ id: `s${i}`, amount: 12, date: "2026-06-08" }),
    );
    const partial = sameDayStreak.slice(0, 4);
    const [day] = groupTransactionsByDay(partial, opts);
    expect(day.rows).toEqual([
      {
        kind: "streak",
        vendor: "Whole Foods",
        amount: 12,
        count: 4,
        transactionIds: ["s0", "s1", "s2", "s3"],
      },
    ]);
  });

  it("never collapses transactions with no vendor, even with identical amounts", () => {
    const a = tx({ id: "a", vendor: undefined, amount: 25 });
    const b = tx({ id: "b", vendor: "", amount: 25 });
    const c = tx({ id: "c", vendor: "   ", amount: 25 });
    const groups = groupTransactionsByDay([a, b, c], opts);
    expect(groups[0].rows).toEqual([
      { kind: "single", transaction: a },
      { kind: "single", transaction: b },
      { kind: "single", transaction: c },
    ]);
  });

  it("orders rows within a day by first-occurrence of each (vendor, amount) bucket", () => {
    // Interleaved input: WF1, Cost1, WF2, Cost2, WF3 — both keys appear ≥ 2x.
    // WF appears first → streak displays at WF's position; Cost streaks second.
    const wf1 = tx({ id: "wf1", vendor: "Whole Foods", amount: 50 });
    const co1 = tx({ id: "co1", vendor: "Costco", amount: 80 });
    const wf2 = tx({ id: "wf2", vendor: "Whole Foods", amount: 50 });
    const co2 = tx({ id: "co2", vendor: "Costco", amount: 80 });
    const wf3 = tx({ id: "wf3", vendor: "Whole Foods", amount: 50 });

    const groups = groupTransactionsByDay([wf1, co1, wf2, co2, wf3], opts);
    expect(groups[0].rows).toEqual([
      {
        kind: "streak",
        vendor: "Whole Foods",
        amount: 50,
        count: 3,
        transactionIds: ["wf1", "wf2", "wf3"],
      },
      {
        kind: "streak",
        vendor: "Costco",
        amount: 80,
        count: 2,
        transactionIds: ["co1", "co2"],
      },
    ]);
  });

  it('labels rows via dayLabel — "Today"/"Yesterday" relative to options.today', () => {
    const today = new Date("2026-06-10T00:00:00Z");
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", date: "2026-06-10" }),
        tx({ id: "b", date: "2026-06-09" }),
        tx({ id: "c", date: "2026-06-08" }),
      ],
      { today },
    );
    expect(groups[0].label).toBe("Today");
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[2].label).toBe("Mon, Jun 8");
  });
});
