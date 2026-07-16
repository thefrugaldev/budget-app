import { describe, expect, it } from "vitest";

import type { Category, Transaction } from "@/types/budget";

import {
  compareCategoriesByRecency,
  lastActivityByCategory,
  recentTransactionsInCategory,
  relativeDayLabel,
} from "./recency";

const cat = (id: string, name: string): Category => ({
  id,
  name,
  kind: "expense",
  activeFrom: "2026-01",
});

const tx = (categoryId: string, date: string, id = `${categoryId}-${date}`): Transaction => ({
  id,
  categoryId,
  amount: 10,
  date,
});

describe("lastActivityByCategory", () => {
  it("maps each category to its most-recent transaction date", () => {
    const map = lastActivityByCategory([
      tx("groc", "2026-06-01"),
      tx("groc", "2026-06-20"),
      tx("groc", "2026-06-10"),
      tx("rent", "2026-05-01"),
    ]);
    expect(map.get("groc")).toBe("2026-06-20");
    expect(map.get("rent")).toBe("2026-05-01");
  });

  it("omits categories with no transactions", () => {
    const map = lastActivityByCategory([tx("groc", "2026-06-01")]);
    expect(map.has("rent")).toBe(false);
  });

  it("is order-independent (max date wins regardless of input order)", () => {
    const forward = lastActivityByCategory([
      tx("groc", "2026-01-01"),
      tx("groc", "2026-12-31"),
    ]);
    const reversed = lastActivityByCategory([
      tx("groc", "2026-12-31"),
      tx("groc", "2026-01-01"),
    ]);
    expect(forward.get("groc")).toBe("2026-12-31");
    expect(reversed.get("groc")).toBe("2026-12-31");
  });
});

describe("compareCategoriesByRecency", () => {
  it("sorts by most-recent activity, descending", () => {
    const cats = [cat("a", "Alpha"), cat("b", "Bravo"), cat("c", "Charlie")];
    const map = new Map([
      ["a", "2026-03-01"],
      ["b", "2026-06-01"],
      ["c", "2026-05-01"],
    ]);
    const sorted = [...cats].sort(compareCategoriesByRecency(map));
    expect(sorted.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts categories with no activity last", () => {
    const cats = [cat("quiet", "Quiet"), cat("busy", "Busy")];
    const map = new Map([["busy", "2026-06-01"]]);
    const sorted = [...cats].sort(compareCategoriesByRecency(map));
    expect(sorted.map((c) => c.id)).toEqual(["busy", "quiet"]);
  });

  it("breaks same-date ties on name ascending for stable order", () => {
    const cats = [cat("z", "Zeta"), cat("a", "Alpha")];
    const map = new Map([
      ["z", "2026-06-01"],
      ["a", "2026-06-01"],
    ]);
    const sorted = [...cats].sort(compareCategoriesByRecency(map));
    expect(sorted.map((c) => c.id)).toEqual(["a", "z"]);
  });

  it("orders two activity-less categories by name", () => {
    const cats = [cat("y", "Yak"), cat("x", "Xerus")];
    const sorted = [...cats].sort(compareCategoriesByRecency(new Map()));
    expect(sorted.map((c) => c.id)).toEqual(["x", "y"]);
  });
});

describe("relativeDayLabel", () => {
  const now = new Date("2026-06-20T12:00:00");

  it("labels undefined activity", () => {
    expect(relativeDayLabel(undefined, now)).toBe("No activity");
  });

  it("labels today and yesterday", () => {
    expect(relativeDayLabel("2026-06-20", now)).toBe("Today");
    expect(relativeDayLabel("2026-06-19", now)).toBe("Yesterday");
  });

  it("labels days, weeks, months, years", () => {
    expect(relativeDayLabel("2026-06-17", now)).toBe("3d ago");
    expect(relativeDayLabel("2026-06-06", now)).toBe("2w ago");
    expect(relativeDayLabel("2026-05-15", now)).toBe("1mo ago");
    expect(relativeDayLabel("2025-01-01", now)).toBe("1y ago");
  });

  it("treats a future-dated row as Today (no negative age)", () => {
    expect(relativeDayLabel("2026-07-01", now)).toBe("Today");
  });

  it("pins to UTC midnight so the day count is timezone-stable", () => {
    // Late-evening local `now` must not tip a same-calendar-day date into
    // "Yesterday" or a 1-day gap into "2d ago".
    const lateNow = new Date("2026-06-20T23:30:00");
    expect(relativeDayLabel("2026-06-20", lateNow)).toBe("Today");
    expect(relativeDayLabel("2026-06-18", lateNow)).toBe("2d ago");
  });
});

describe("recentTransactionsInCategory", () => {
  it("returns only the given category's transactions, newest first", () => {
    const recent = recentTransactionsInCategory(
      [
        tx("groc", "2026-06-01"),
        tx("rent", "2026-06-30"),
        tx("groc", "2026-06-20"),
        tx("groc", "2026-06-10"),
      ],
      "groc",
    );
    expect(recent.map((t) => t.date)).toEqual([
      "2026-06-20",
      "2026-06-10",
      "2026-06-01",
    ]);
  });

  it("caps to the limit (default 12), keeping the most recent", () => {
    const txns = Array.from({ length: 20 }, (_, i) =>
      tx("groc", `2026-06-${String(i + 1).padStart(2, "0")}`),
    );
    const recent = recentTransactionsInCategory(txns, "groc");
    expect(recent).toHaveLength(12);
    expect(recent[0].date).toBe("2026-06-20");
    expect(recent[11].date).toBe("2026-06-09");
  });

  it("honors a custom limit", () => {
    const txns = [
      tx("groc", "2026-06-03"),
      tx("groc", "2026-06-02"),
      tx("groc", "2026-06-01"),
    ];
    expect(recentTransactionsInCategory(txns, "groc", 2)).toHaveLength(2);
  });

  it("breaks same-date ties on id descending for a stable slice", () => {
    const recent = recentTransactionsInCategory(
      [
        tx("groc", "2026-06-10", "a"),
        tx("groc", "2026-06-10", "c"),
        tx("groc", "2026-06-10", "b"),
      ],
      "groc",
    );
    expect(recent.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("returns an empty array when the category has no transactions", () => {
    expect(recentTransactionsInCategory([tx("groc", "2026-06-01")], "rent")).toEqual([]);
  });
});
