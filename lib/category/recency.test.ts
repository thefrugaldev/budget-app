import { describe, expect, it } from "vitest";

import type { Category, Transaction } from "@/types/budget";

import { compareCategoriesByRecency, lastActivityByCategory } from "./recency";

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
