import { describe, expect, it } from "vitest";

import {
  flattenNavigableRows,
  groupTransactionsByDay,
  streakKey,
} from "./transaction";
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

  it("collapses a same-vendor uniform run of ≥ 2 into a CollapsedStreak with a unit amount", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", amount: 87.42 }),
        tx({ id: "b", amount: 87.42 }),
        tx({ id: "c", amount: 87.42 }),
        tx({ id: "d", amount: 87.42 }),
      ],
      opts,
    );
    const [row] = groups[0].rows;
    if (row.kind !== "streak") throw new Error("expected a streak row");
    // Every member shares 87.42 → `amount` is populated so the UI can show
    // "4× $87.42".
    expect(row).toMatchObject({
      kind: "streak",
      vendor: "Whole Foods",
      amount: 87.42,
      count: 4,
      transactionIds: ["a", "b", "c", "d"],
    });
    expect(row.subtotal).toBeCloseTo(349.68, 2);
    expect(groups[0].subtotal).toBeCloseTo(349.68, 2);
  });

  it("collapses a same-vendor run at different amounts; subtotal sums, amount omitted (the realistic case)", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", vendor: "Whole Foods", amount: 45 }),
        tx({ id: "b", vendor: "Whole Foods", amount: 92.5 }),
        tx({ id: "c", vendor: "Whole Foods", amount: 85 }),
      ],
      opts,
    );
    expect(groups[0].rows).toEqual([
      {
        kind: "streak",
        vendor: "Whole Foods",
        count: 3,
        subtotal: 222.5,
        transactionIds: ["a", "b", "c"],
      },
    ]);
    const [row] = groups[0].rows;
    if (row.kind !== "streak") throw new Error("expected a streak row");
    // Amounts vary → no single unit price to show.
    expect(row.amount).toBeUndefined();
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
    if (row.kind !== "streak") throw new Error("expected a streak row");
    expect(row.count).toBe(3);
    expect(row.transactionIds).toEqual(["a", "b", "c"]);
  });

  it("nets a purchase and a refund at one vendor into a single streak (subtotal 40)", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", vendor: "Target", amount: 50 }),
        tx({ id: "b", vendor: "Target", amount: -10 }),
      ],
      opts,
    );
    expect(groups[0].subtotal).toBe(40);
    // Same vendor, differing amounts → one streak whose subtotal nets the
    // refund; `amount` is omitted.
    expect(groups[0].rows).toEqual([
      {
        kind: "streak",
        vendor: "Target",
        count: 2,
        subtotal: 40,
        transactionIds: ["a", "b"],
      },
    ]);
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
        subtotal: -20,
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
        subtotal: 48,
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

  it("orders rows within a day by first-occurrence of each vendor bucket", () => {
    // Interleaved input: WF1, Cost1, WF2, Cost2, WF3 — both vendors appear ≥ 2x.
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
        subtotal: 150,
        transactionIds: ["wf1", "wf2", "wf3"],
      },
      {
        kind: "streak",
        vendor: "Costco",
        amount: 80,
        count: 2,
        subtotal: 160,
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

  it("labels dates across a month boundary with the long form", () => {
    // today = Jun 1; yesterday is May 31 — must read "Sun, May 31", not a
    // June-flavoured "Sun, Jun 31"-style mistake.
    const today = new Date("2026-06-01T00:00:00Z");
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", date: "2026-06-01" }),
        tx({ id: "b", date: "2026-05-31" }),
        tx({ id: "c", date: "2026-05-30" }),
      ],
      { today },
    );
    expect(groups[0].label).toBe("Today");
    expect(groups[1].label).toBe("Yesterday");
    expect(groups[2].label).toBe("Sat, May 30");
  });
});

describe("streakKey", () => {
  it("builds a stable key from date + vendor", () => {
    expect(streakKey("2026-06-08", "Whole Foods")).toBe(
      "streak:2026-06-08:Whole Foods",
    );
  });

  it("distinguishes different vendors on the same day", () => {
    expect(streakKey("2026-06-08", "Whole Foods")).not.toBe(
      streakKey("2026-06-08", "Costco"),
    );
  });
});

describe("flattenNavigableRows", () => {
  const never = () => false;
  const always = () => true;
  const allPresent = () => true;

  it("returns empty results for no day groups", () => {
    const { orderedRowKeys, sectionIndexByKey, sectionFirstKeys } =
      flattenNavigableRows([], never, allPresent);
    expect(orderedRowKeys).toEqual([]);
    expect(sectionIndexByKey.size).toBe(0);
    expect(sectionFirstKeys).toEqual([]);
  });

  it("lists single rows by id in DOM order across days", () => {
    const groups = groupTransactionsByDay(
      [
        tx({ id: "a", date: "2026-06-10", vendor: "Solo A" }),
        tx({ id: "b", date: "2026-06-09", vendor: "Solo B" }),
      ],
      opts,
    );
    const { orderedRowKeys, sectionIndexByKey, sectionFirstKeys } =
      flattenNavigableRows(groups, never, allPresent);
    // Newest day first, mirroring groupTransactionsByDay's ordering.
    expect(orderedRowKeys).toEqual(["a", "b"]);
    expect(sectionIndexByKey.get("a")).toBe(0);
    expect(sectionIndexByKey.get("b")).toBe(1);
    // One section per day; each section's first key is its lone row, indexed
    // by section so the caller can resolve a tab stop by section index in O(1).
    expect(sectionFirstKeys).toEqual(["a", "b"]);
  });

  it("contributes only the streak header key when the streak is closed", () => {
    const groups = groupTransactionsByDay(
      [tx({ id: "a" }), tx({ id: "b" })],
      opts,
    );
    const key = streakKey("2026-06-08", "Whole Foods");
    const { orderedRowKeys } = flattenNavigableRows(groups, never, allPresent);
    expect(orderedRowKeys).toEqual([key]);
  });

  it("appends underlying row ids after the header when the streak is open", () => {
    const groups = groupTransactionsByDay(
      [tx({ id: "a" }), tx({ id: "b" })],
      opts,
    );
    const key = streakKey("2026-06-08", "Whole Foods");
    const { orderedRowKeys, sectionIndexByKey, sectionFirstKeys } =
      flattenNavigableRows(groups, always, allPresent);
    expect(orderedRowKeys).toEqual([key, "a", "b"]);
    // The expanded children share their header's day-group section.
    expect(sectionIndexByKey.get(key)).toBe(0);
    expect(sectionIndexByKey.get("a")).toBe(0);
    expect(sectionIndexByKey.get("b")).toBe(0);
    // The section's first navigable key is the streak header, not a child.
    expect(sectionFirstKeys).toEqual([key]);
  });

  it("drops an open streak's children that no longer exist (optimistic delete)", () => {
    const groups = groupTransactionsByDay(
      [tx({ id: "a" }), tx({ id: "b" }), tx({ id: "c" })],
      opts,
    );
    const key = streakKey("2026-06-08", "Whole Foods");
    // "b" is mid-delete: still in the grouped data but hidden from the live set.
    const { orderedRowKeys } = flattenNavigableRows(
      groups,
      always,
      (id) => id !== "b",
    );
    expect(orderedRowKeys).toEqual([key, "a", "c"]);
  });
});
