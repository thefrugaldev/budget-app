import { describe, expect, it } from "vitest";

import {
  categoryZeroState,
  expectedMonthlyCategories,
  inRangeActivityCounts,
} from "@/lib/category/cadence";
import type { Transaction } from "@/types/budget";

const NOW = new Date("2026-08-15T00:00:00Z"); // current month = 2026-08

function tx(categoryId: string, date: string, amount = 100): Transaction {
  return { id: `${categoryId}-${date}`, categoryId, date, amount };
}

describe("expectedMonthlyCategories", () => {
  it("flags a category active in all four window months (Apr–Jul)", () => {
    const txns = [
      tx("mortgage", "2026-04-01"),
      tx("mortgage", "2026-05-01"),
      tx("mortgage", "2026-06-01"),
      tx("mortgage", "2026-07-01"),
    ];
    expect(expectedMonthlyCategories(txns, NOW)).toEqual(new Set(["mortgage"]));
  });

  it("flags a category active in exactly three of four months (one skipped)", () => {
    const txns = [
      tx("water", "2026-04-10"),
      tx("water", "2026-05-10"),
      // June skipped
      tx("water", "2026-07-10"),
    ];
    expect(expectedMonthlyCategories(txns, NOW).has("water")).toBe(true);
  });

  it("does not flag a category active in only two of four months", () => {
    const txns = [tx("oneoff", "2026-05-03"), tx("oneoff", "2026-07-20")];
    expect(expectedMonthlyCategories(txns, NOW).has("oneoff")).toBe(false);
  });

  it("excludes the in-progress current month from the window", () => {
    // Three current-month rows plus one prior month — only one complete month
    // counts, so it stays below the 3-of-4 bar.
    const txns = [
      tx("cur", "2026-08-01"),
      tx("cur", "2026-08-08"),
      tx("cur", "2026-08-15"),
      tx("cur", "2026-07-01"),
    ];
    expect(expectedMonthlyCategories(txns, NOW).has("cur")).toBe(false);
  });

  it("counts distinct months, not transaction volume, within a month", () => {
    // Many rows in a single month is still one active month.
    const txns = [
      tx("groceries", "2026-07-01"),
      tx("groceries", "2026-07-08"),
      tx("groceries", "2026-07-15"),
      tx("groceries", "2026-07-22"),
    ];
    expect(expectedMonthlyCategories(txns, NOW).has("groceries")).toBe(false);
  });

  it("ignores months outside the trailing window (a category that stopped months ago)", () => {
    const txns = [
      tx("old", "2025-11-01"),
      tx("old", "2025-12-01"),
      tx("old", "2026-01-01"),
      tx("old", "2026-02-01"),
    ];
    expect(expectedMonthlyCategories(txns, NOW).has("old")).toBe(false);
  });
});

describe("inRangeActivityCounts", () => {
  it("counts transactions within the inclusive month window", () => {
    const txns = [
      tx("a", "2026-08-01"),
      tx("a", "2026-08-31"),
      tx("a", "2026-07-31"), // just before
      tx("b", "2026-08-10"),
    ];
    const counts = inRangeActivityCounts(txns, "2026-08", "2026-08");
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
  });

  it("counts a netted-to-zero pair as activity, not silence", () => {
    const txns = [tx("c", "2026-08-05", 50), tx("c", "2026-08-06", -50)];
    expect(inRangeActivityCounts(txns, "2026-08", "2026-08").get("c")).toBe(2);
  });

  it("omits categories with no in-range rows", () => {
    const counts = inRangeActivityCounts([tx("a", "2026-06-01")], "2026-08", "2026-08");
    expect(counts.has("a")).toBe(false);
  });
});

describe("categoryZeroState", () => {
  const base = {
    inRangeCount: 0,
    isSingleMonth: true,
    isCurrentMonth: true,
    isExpected: true,
  };

  it("returns null when the category has in-range activity", () => {
    expect(categoryZeroState({ ...base, inRangeCount: 1 })).toBeNull();
  });

  it("returns null for a multi-month range", () => {
    expect(categoryZeroState({ ...base, isSingleMonth: false })).toBeNull();
  });

  it("warns 'None yet' for an expected, silent current month", () => {
    expect(categoryZeroState(base)).toEqual({ label: "None yet", tone: "warn" });
  });

  it("stays muted for a silent current month that isn't expected", () => {
    expect(categoryZeroState({ ...base, isExpected: false })).toEqual({
      label: "Nothing logged",
      tone: "muted",
    });
  });

  it("stays muted for an expected category in a past single month (not 'yet')", () => {
    expect(categoryZeroState({ ...base, isCurrentMonth: false })).toEqual({
      label: "Nothing logged",
      tone: "muted",
    });
  });
});
