import { describe, expect, it } from "vitest";

import { planBackfill } from "@/lib/auth/backfill";
import type { BackfillableDoc } from "@/types/auth";

const doc = (id: string, householdId?: string): BackfillableDoc => ({
  id,
  ...(householdId ? { householdId } : {}),
});

describe("planBackfill", () => {
  it("stamps only the documents missing a householdId", () => {
    const plan = planBackfill("h1", {
      transactions: [doc("t1"), doc("t2", "h1"), doc("t3")],
    });
    expect(plan).toEqual({
      householdId: "h1",
      byCollection: { transactions: ["t1", "t3"] },
      total: 2,
    });
  });

  it("spans multiple collections and sums the total", () => {
    const plan = planBackfill("h1", {
      categories: [doc("c1"), doc("c2")],
      transactions: [doc("t1")],
    });
    expect(plan.byCollection).toEqual({
      categories: ["c1", "c2"],
      transactions: ["t1"],
    });
    expect(plan.total).toBe(3);
  });

  it("is idempotent — a fully-stamped set plans no writes but keeps every collection", () => {
    const plan = planBackfill("h1", {
      categories: [doc("c1", "h1")],
      transactions: [],
    });
    expect(plan).toEqual({
      householdId: "h1",
      byCollection: { categories: [], transactions: [] },
      total: 0,
    });
  });

  it("never hijacks a document already owned by another household", () => {
    const plan = planBackfill("h1", {
      transactions: [doc("t1", "other-household"), doc("t2")],
    });
    expect(plan.byCollection.transactions).toEqual(["t2"]);
  });

  it("returns an empty plan for no collections", () => {
    expect(planBackfill("h1", {})).toEqual({
      householdId: "h1",
      byCollection: {},
      total: 0,
    });
  });
});
