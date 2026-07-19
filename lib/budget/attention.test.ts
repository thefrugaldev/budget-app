import { describe, expect, it } from "vitest";

import type { Category, CategoryKind, RangeAggregate } from "@/types/budget";

import {
  DEFAULT_ATTENTION_LIMIT,
  PACE_TOLERANCE,
  PENDING_UNTIL,
  selectAttention,
} from "./attention";

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

/** Options for the in-progress current month at a given elapsed fraction. */
const pace = (monthProgress: number) => ({ pace: { monthProgress } });

/** Convenience: single-category run, current-month pace mode, returning the row. */
function rowWithPace(
  category: Category,
  total: number,
  denominator: number,
  progress: number,
) {
  const { rows } = selectAttention(
    [category],
    [agg(category.id, total, denominator)],
    undefined,
    pace(progress),
  );
  return rows[0] ?? null;
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

describe("selectAttention — pace-aware (in-progress current month)", () => {
  const s = cat("hysa", "savings");

  it("treats an untouched goal as pending (not a row) early in the month", () => {
    const before = PENDING_UNTIL - 0.1;
    const result = selectAttention(
      [s],
      [agg(s.id, 0, 1000)],
      undefined,
      pace(before),
    );
    expect(result.rows).toEqual([]); // not an exception
    expect(result.pending).toHaveLength(1);
    expect(result.pending[0]).toMatchObject({ goal: 1000 });
    expect(result.pending[0].category.id).toBe("hysa");
  });

  it("promotes an untouched goal to behind (full goal) once late", () => {
    const after = PENDING_UNTIL + 0.1;
    const row = rowWithPace(s, 0, 1000, after);
    expect(row?.reason).toBe("behind");
    expect(row?.gap).toBe(1000);
    expect(row?.action).toBe("Fund $1,000 to catch up");
  });

  it("flags a partially-funded goal that trails pace by more than tolerance", () => {
    // progress 0.8 → expected 800; tolerance is 10% of goal (100), so behind
    // below 700. 500 qualifies; gap catches up to the expected pace.
    const row = rowWithPace(s, 500, 1000, 0.8);
    expect(row?.reason).toBe("behind");
    expect(row?.gap).toBeCloseTo(300); // 800 − 500
    expect(row?.action).toBe("Fund $300 to catch up");
  });

  it("leaves a goal keeping pace on track (within tolerance)", () => {
    // progress 0.5 → expected 500; within tolerance (≥400) reads as on track.
    expect(rowWithPace(s, 450, 1000, 0.5)).toBeNull();
    // Right at the pace line is fine too.
    expect(rowWithPace(s, 500, 1000, 0.5)).toBeNull();
    // Tolerance is 10% of the goal.
    expect(PACE_TOLERANCE).toBe(0.1);
  });

  it("always surfaces a withdrawal, even early in the month", () => {
    const row = rowWithPace(s, -200, 1000, 0.05);
    expect(row?.reason).toBe("withdrawn");
    expect(row?.gap).toBe(200);
    expect(row?.action).toBe("Withdrew $200");
  });

  it("always surfaces an over-cap expense, even early in the month", () => {
    const e = cat("dining", "expense");
    const row = rowWithPace(e, 200, 100, 0.05);
    expect(row?.reason).toBe("over-cap");
    expect(row?.gap).toBe(100);
    expect(row?.action).toBe("Over by $100");
  });

  it("still recognises a met goal under pace", () => {
    expect(rowWithPace(s, 1000, 1000, 0.2)?.reason).toBe("goal-met");
  });

  it("does NOT soften a closed window: $0 stays not-started without pace", () => {
    // No pace option (a past/multi-month window) — $0 is genuinely missed.
    const result = selectAttention([s], [agg(s.id, 0, 1000)]);
    expect(result.pending).toEqual([]);
    expect(result.rows[0]?.reason).toBe("not-started");
    expect(result.rows[0]?.action).toBe("Fund $1,000");
  });

  it("reports evaluated / on-track counts and keeps pending out of both", () => {
    const cats = [
      cat("over", "expense"),
      cat("pending", "savings"),
      cat("onpace", "savings"),
      cat("met", "savings"),
    ];
    const aggs = [
      agg("over", 200, 100), // over-cap → problem
      agg("pending", 0, 1000), // early $0 → pending
      agg("onpace", 900, 1000), // ahead of pace → on track
      agg("met", 1000, 1000), // met → on track (success)
    ];
    const result = selectAttention(cats, aggs, undefined, pace(0.2));
    expect(result.evaluatedCount).toBe(4);
    expect(result.pending).toHaveLength(1);
    // 4 judged − 1 pending − 1 problem (over-cap) = 2 on track (onpace + met).
    expect(result.onTrackCount).toBe(2);
    expect(result.rows.map((r) => r.reason)).toEqual(["over-cap", "goal-met"]);
  });

  it("counts every category on track when nothing is wrong", () => {
    const cats = [cat("a", "expense"), cat("b", "savings")];
    const aggs = [agg("a", 40, 100), agg("b", 900, 1000)];
    const result = selectAttention(cats, aggs, undefined, pace(0.5));
    expect(result.rows).toEqual([]);
    expect(result.pending).toEqual([]);
    expect(result.evaluatedCount).toBe(2);
    expect(result.onTrackCount).toBe(2);
  });

  it("excludes income from the evaluated count", () => {
    const cats = [cat("salary", "income"), cat("food", "expense")];
    const aggs = [agg("salary", 0, 5000), agg("food", 40, 100)];
    const result = selectAttention(cats, aggs, undefined, pace(0.5));
    expect(result.evaluatedCount).toBe(1); // only the expense is judged
    expect(result.onTrackCount).toBe(1);
  });
});
