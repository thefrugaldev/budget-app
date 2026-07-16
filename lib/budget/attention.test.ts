import { describe, expect, it } from "vitest";

import type { Category, CategoryKind, RangeAggregate } from "@/types/budget";

import { DEFAULT_ATTENTION_LIMIT, selectAttention } from "./attention";

const cat = (id: string, kind: CategoryKind, name = id): Category => ({
  id,
  name,
  kind,
  activeFrom: "2026-01",
});

const agg = (categoryId: string, total: number, denominator: number): RangeAggregate => ({
  categoryId,
  total,
  denominator,
});

/** Convenience: run the selector for one category + its aggregate. */
function reasonFor(category: Category, total: number, denominator: number) {
  const { rows } = selectAttention([category], [agg(category.id, total, denominator)]);
  return rows[0]?.reason ?? null;
}

describe("selectAttention — classification", () => {
  it("flags an expense only when it is over cap", () => {
    const e = cat("dining", "expense");
    expect(reasonFor(e, 150, 100)).toBe("over-cap");
    expect(reasonFor(e, 100, 100)).toBeNull(); // at cap → fine
    expect(reasonFor(e, 95, 100)).toBeNull(); // near → fine
    expect(reasonFor(e, 40, 100)).toBeNull(); // under → fine
  });

  it("classifies savings shortfalls and met goals", () => {
    const s = cat("hysa", "savings");
    expect(reasonFor(s, -50, 500)).toBe("withdrawn"); // net negative
    expect(reasonFor(s, 0, 500)).toBe("not-started"); // goal set, untouched
    expect(reasonFor(s, 100, 500)).toBe("behind"); // < 70% of goal
    expect(reasonFor(s, 500, 500)).toBe("goal-met"); // reached
    expect(reasonFor(s, 400, 500)).toBeNull(); // 80% → near → on track
    expect(reasonFor(s, 480, 500)).toBeNull(); // 96% → at → on track
  });

  it("skips categories with no cap/goal this month (denominator 0)", () => {
    expect(reasonFor(cat("e", "expense"), 999, 0)).toBeNull();
    expect(reasonFor(cat("s", "savings"), 0, 0)).toBeNull();
  });

  it("ignores income categories (out of scope for the module)", () => {
    expect(reasonFor(cat("salary", "income"), 0, 5000)).toBeNull();
  });

  it("skips a category with no matching aggregate", () => {
    const { rows } = selectAttention([cat("orphan", "expense")], []);
    expect(rows).toEqual([]);
  });

  it("carries the threshold descriptor's text label (not color alone)", () => {
    const { rows } = selectAttention(
      [cat("dining", "expense")],
      [agg("dining", 150, 100)],
    );
    expect(rows[0].descriptor.label).toBe("Over cap");
    expect(rows[0].descriptor.tone).toBe("bad");
  });
});

describe("selectAttention — ordering & cap", () => {
  it("orders by severity: over-cap, withdrawn, not-started, behind, goal-met", () => {
    const categories = [
      cat("met", "savings"),
      cat("behind", "savings"),
      cat("notStarted", "savings"),
      cat("withdrawn", "savings"),
      cat("overCap", "expense"),
    ];
    const aggregates = [
      agg("met", 500, 500),
      agg("behind", 100, 500),
      agg("notStarted", 0, 500),
      agg("withdrawn", -20, 500),
      agg("overCap", 150, 100),
    ];
    const { rows } = selectAttention(categories, aggregates);
    expect(rows.map((r) => r.reason)).toEqual([
      "over-cap",
      "withdrawn",
      "not-started",
      "behind",
      "goal-met",
    ]);
  });

  it("breaks ties within a reason by name", () => {
    const categories = [cat("z", "expense", "Zeta"), cat("a", "expense", "Alpha")];
    const aggregates = [agg("z", 200, 100), agg("a", 200, 100)];
    const { rows } = selectAttention(categories, aggregates);
    expect(rows.map((r) => r.category.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("caps the rows and reports how many were hidden", () => {
    const categories = Array.from({ length: 8 }, (_, i) =>
      cat(`e${i}`, "expense", `Cat ${i}`),
    );
    const aggregates = categories.map((c) => agg(c.id, 200, 100));
    const { rows, hiddenCount } = selectAttention(categories, aggregates, 3);
    expect(rows).toHaveLength(3);
    expect(hiddenCount).toBe(5);
  });

  it("returns every match with no cap when limit is Infinity", () => {
    const categories = Array.from({ length: 6 }, (_, i) =>
      cat(`e${i}`, "expense", `Cat ${i}`),
    );
    const aggregates = categories.map((c) => agg(c.id, 200, 100));
    const { rows, hiddenCount } = selectAttention(categories, aggregates, Infinity);
    expect(rows).toHaveLength(6);
    expect(hiddenCount).toBe(0);
  });

  it("treats a negative limit as zero rows (all counted hidden), not a slice surprise", () => {
    const categories = [cat("a", "expense"), cat("b", "expense")];
    const aggregates = [agg("a", 200, 100), agg("b", 200, 100)];
    const { rows, hiddenCount } = selectAttention(categories, aggregates, -1);
    expect(rows).toEqual([]);
    expect(hiddenCount).toBe(2);
  });

  it("reports zero hidden when everything fits", () => {
    const { rows, hiddenCount } = selectAttention(
      [cat("e", "expense")],
      [agg("e", 200, 100)],
    );
    expect(rows).toHaveLength(1);
    expect(hiddenCount).toBe(0);
  });

  it("defaults to a handful of rows", () => {
    expect(DEFAULT_ATTENTION_LIMIT).toBe(5);
  });
});
