import { describe, expect, it } from "vitest";

import { buildExtract } from "./build-manifest";
import {
  buildFixtureWorkbook,
  fixtureIncome,
  fixtureMapping,
  fixtureOverrides,
} from "./fixtures/build-fixture-workbook";
import { readWorkbookBuffer } from "./workbook";
import type { ExtractResult } from "./manifest-types";

async function extract(opts?: { includeUnreconciled?: boolean }): Promise<ExtractResult> {
  const buf = await buildFixtureWorkbook(opts);
  const wb = await readWorkbookBuffer(buf, "2023.xlsx");
  return buildExtract({
    workbooks: [wb],
    mapping: fixtureMapping,
    overrides: fixtureOverrides,
    income: fixtureIncome,
  });
}

describe("buildExtract — transactions", () => {
  it("emits reconciled expense lines with vendor, note, and provenance", async () => {
    const { workbooks } = await extract();
    const txns = workbooks[0].transactions;

    const costco = txns.find((t) => t.importRef === "2023.xlsx!2023!B2#1")!;
    expect(costco).toMatchObject({
      amount: 52.1,
      date: "2023-01-03",
      vendor: "Costco",
      note: "household",
      categoryId: expect.any(String),
    });
    const safeway = txns.find((t) => t.importRef === "2023.xlsx!2023!B2#2")!;
    expect(safeway).toMatchObject({ amount: 100, date: "2023-01-10", vendor: "Safeway" });
  });

  it("dates by budget month and preserves the true paid date", async () => {
    const { workbooks } = await extract();
    const txns = workbooks[0].transactions;

    // Paid 1/31, budgeted February → clamped to the 28th, note carries the truth.
    const feb = txns.find((t) => t.importRef === "2023.xlsx!2023!C2#1")!;
    expect(feb).toMatchObject({ date: "2023-02-28", note: "(paid 1/31)" });

    // A December bill budgeted to January.
    const mortgage = txns.find((t) => t.importRef === "2023.xlsx!2023!B3#1")!;
    expect(mortgage).toMatchObject({
      date: "2023-01-28",
      note: "(paid 12/28)",
      vendor: "Chase Mortgage", // vendor rewrite applied
      amount: 1900,
    });
  });

  it("reconciles a refund cell via the keyword sign-flip", async () => {
    const { workbooks, reconciliation } = await extract();
    const txns = workbooks[0].transactions;

    const spend = txns.find((t) => t.importRef === "2023.xlsx!2023!D2#1")!;
    const refund = txns.find((t) => t.importRef === "2023.xlsx!2023!D2#2")!;
    expect(spend.amount).toBe(20);
    expect(refund.amount).toBe(-20); // flipped to reconcile the zero cell

    const cell = reconciliation.cells.find((c) => c.ref === "2023.xlsx!2023!D2")!;
    expect(cell.status).toBe("reconciled-by-flip");
    expect(cell.autoFlippedLines).toEqual([2]);
  });

  it("applies a set-date override to the emitted transaction date", async () => {
    const buf = await buildFixtureWorkbook();
    const wb = await readWorkbookBuffer(buf, "2023.xlsx");
    const result = buildExtract({
      workbooks: [wb],
      mapping: fixtureMapping,
      // Re-date the Safeway line (B2 line 2) to 1/15 without changing the sum.
      overrides: {
        cells: { "2023.xlsx!2023!B2": [{ line: 2, action: "set-date", month: 1, day: 15, reason: "fix" }] },
        refundKeywords: ["refund"],
      },
      income: fixtureIncome,
    });
    const safeway = result.workbooks[0].transactions.find(
      (t) => t.importRef === "2023.xlsx!2023!B2#2",
    )!;
    expect(safeway.date).toBe("2023-01-15");
    // Sum is unchanged, so the cell still reconciles.
    expect(result.reconciliation.unreconciled).toBe(0);
  });

  it("emits a savings cell as a month-end monthly total", async () => {
    const { workbooks } = await extract();
    const brokerage = workbooks[0].transactions.find(
      (t) => t.importRef === "2023.xlsx!2023!B4#1",
    )!;
    expect(brokerage).toMatchObject({
      amount: 500,
      date: "2023-01-31",
      note: "Imported monthly total",
    });
    expect(brokerage.vendor).toBeUndefined();
  });
});

describe("buildExtract — categories, targets, income, liabilities", () => {
  it("derives categories with active windows and links transactions by id", async () => {
    const result = await extract();
    const groceries = result.categories.categories.find((c) => c.name === "Groceries")!;
    expect(groceries).toMatchObject({ kind: "expense", icon: "ShoppingCart", activeFrom: "2023-01" });

    // A transaction's categoryId is the category document's _id (stable hash).
    const tx = result.workbooks[0].transactions.find((t) => t.importRef === "2023.xlsx!2023!B2#1")!;
    expect(tx.categoryId).toBe(groceries._id);

    // Dining is mapped but never used (no override) → omitted from the manifest.
    expect(result.categories.categories.some((c) => c.name === "Dining")).toBe(false);
  });

  it("imports estimates as effective-dated targets", async () => {
    const { workbooks } = await extract();
    const targets = workbooks[0].estimateTargets;
    expect(targets).toContainEqual(
      expect.objectContaining({ monthly: 150, effectiveFrom: "2023-01" }),
    );
  });

  it("builds income categories and per-year W-2 baselines", async () => {
    const { categories } = await extract();
    const salary = categories.categories.find((c) => c.name === "Salary")!;
    expect(salary).toMatchObject({ kind: "income", payCadence: "bi-weekly", firstPaycheckDate: "2023-01-06" });

    const baseline = categories.incomeBaselines.find((b) => b.categoryId === salary._id)!;
    expect(baseline).toMatchObject({ monthly: 10000, effectiveFrom: "2023-01" }); // 120000 / 12
  });

  it("extracts month-end liability snapshots (applied later, #109)", async () => {
    const { workbooks } = await extract();
    const snaps = workbooks[0].liabilitySnapshots;
    expect(snaps).toContainEqual(
      expect.objectContaining({ liability: "Mortgage", date: "2023-01-31", balance: 300000 }),
    );
  });
});

describe("buildExtract — reports and the gate", () => {
  it("tallies vendors by rewritten name", async () => {
    const { vendors } = await extract();
    expect(vendors.vendors.find((v) => v.vendor === "Costco")).toMatchObject({ count: 2 });
    expect(vendors.vendors.find((v) => v.vendor === "Chase Mortgage")).toMatchObject({ count: 1 });
  });

  it("flags an unbalanced cell as unreconciled and emits no transaction for it", async () => {
    const result = await extract({ includeUnreconciled: true });
    expect(result.reconciliation.unreconciled).toBe(1);
    const bad = result.reconciliation.cells.find((c) => c.ref === "2023.xlsx!2023!B5")!;
    expect(bad.status).toBe("unreconciled");
    expect(bad.deltaCents).toBe(-7000); // 30.00 itemized vs 100.00 cell
    expect(result.workbooks[0].transactions.some((t) => t.importRef.startsWith("2023.xlsx!2023!B5"))).toBe(false);
  });

  it("is deterministic — same inputs, identical output", async () => {
    const a = await extract();
    const b = await extract();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
