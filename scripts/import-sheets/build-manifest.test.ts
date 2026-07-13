import { describe, expect, it } from "vitest";

import { buildExtract } from "./build-manifest";
import {
  buildFixtureWorkbook,
  fixtureIncome,
  fixtureMapping,
  fixtureOverrides,
} from "./fixtures/build-fixture-workbook";
import { readWorkbookBuffer } from "./workbook";
import type { RawWorkbook } from "./workbook";
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

  it("emits an add-line synthetic as a real transaction (unitemized remainder)", async () => {
    // The Dining cell (B5: $100 with only $30 itemized) is unreconciled without
    // an override; an add-line for the $70 remainder reconciles it and becomes
    // a manifest transaction with a deterministic importRef at line 2. The
    // vendor "Chase" proves the rewrite rules apply to added lines too, and
    // month 12 in a January cell proves budget-month coercion applies.
    const buf = await buildFixtureWorkbook({ includeUnreconciled: true });
    const wb = await readWorkbookBuffer(buf, "2023.xlsx");
    const overrides = {
      cells: {
        "2023.xlsx!2023!B5": [
          { line: 2, action: "add-line" as const, day: 30, month: 12, amountCents: 7000, vendor: "Chase", note: "card autopay", reason: "unitemized remainder" },
        ],
      },
      refundKeywords: ["refund"],
    };
    const run = () =>
      buildExtract({ workbooks: [wb], mapping: fixtureMapping, overrides, income: fixtureIncome });

    const result = run();
    expect(result.reconciliation.unreconciled).toBe(0);
    const added = result.workbooks[0].transactions.find(
      (t) => t.importRef === "2023.xlsx!2023!B5#2",
    )!;
    expect(added).toMatchObject({
      amount: 70,
      date: "2023-01-30", // Dec bill coerced into the January budget month
      note: "card autopay (paid 12/30)",
      vendor: "Chase Mortgage", // rewrite applied
    });

    // Deterministic across runs: same inputs, identical ids and output.
    expect(JSON.stringify(run())).toBe(JSON.stringify(result));
  });

  it("defaults an add-line's month to the cell's own column month (no paid note)", async () => {
    const buf = await buildFixtureWorkbook({ includeUnreconciled: true });
    const wb = await readWorkbookBuffer(buf, "2023.xlsx");
    const result = buildExtract({
      workbooks: [wb],
      mapping: fixtureMapping,
      overrides: {
        cells: {
          "2023.xlsx!2023!B5": [
            { line: 2, action: "add-line" as const, day: 20, amountCents: 7000, reason: "unitemized remainder" },
          ],
        },
        refundKeywords: [],
      },
      income: fixtureIncome,
    });
    const added = result.workbooks[0].transactions.find(
      (t) => t.importRef === "2023.xlsx!2023!B5#2",
    )!;
    expect(added.date).toBe("2023-01-20"); // the cell's own January column
    expect(added.note).toBeUndefined(); // no coercion, no paid note
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

  it("canonicalizes a display-ugly liability header", async () => {
    const buf = await buildFixtureWorkbook({ uglyLiabilityHeader: true });
    const wb = await readWorkbookBuffer(buf, "2023.xlsx");
    const { workbooks } = buildExtract({
      workbooks: [wb],
      mapping: fixtureMapping,
      overrides: fixtureOverrides,
      income: fixtureIncome,
    });
    // "Home Loan" resolves to "Mortgage" via mapping.liabilities.
    expect(workbooks[0].liabilitySnapshots.every((s) => s.liability === "Mortgage")).toBe(true);
  });
});

describe("buildExtract — skipRows and the unmapped-nonzero gate", () => {
  it("skips a declared derived-total row even when nonzero", async () => {
    const buf = await buildFixtureWorkbook({ includeSkipRow: true });
    const wb = await readWorkbookBuffer(buf, "2023.xlsx");
    const result = buildExtract({
      workbooks: [wb],
      mapping: fixtureMapping,
      overrides: fixtureOverrides,
      income: fixtureIncome,
    });
    // No category, no transaction, no error from the "Total" row.
    expect(result.categories.categories.some((c) => c.name === "Total")).toBe(false);
    expect(result.workbooks[0].transactions.some((t) => t.categoryId === undefined)).toBe(false);
  });

  it("still hard-errors a nonzero row that is neither mapped nor skipped", async () => {
    const buf = await buildFixtureWorkbook({ includeUnmappedNonzero: true });
    const wb = await readWorkbookBuffer(buf, "2023.xlsx");
    expect(() =>
      buildExtract({
        workbooks: [wb],
        mapping: fixtureMapping,
        overrides: fixtureOverrides,
        income: fixtureIncome,
      }),
    ).toThrow(/unmapped but has nonzero values/);
  });
});

describe("buildExtract — liability payoff cross-check", () => {
  async function crossCheck(opts: Parameters<typeof buildFixtureWorkbook>[0]) {
    const wb = await readWorkbookBuffer(await buildFixtureWorkbook(opts), "2023.xlsx");
    return buildExtract({
      workbooks: [wb],
      mapping: fixtureMapping,
      overrides: fixtureOverrides,
      income: fixtureIncome,
    }).reconciliation;
  }

  it("passes when the payoff quote is within 0.5% of the balance", async () => {
    const recon = await crossCheck({ payoffMode: "pass" });
    expect(recon.liabilityCrossChecksTotal).toBe(1);
    expect(recon.liabilityCrossChecksPassed).toBe(1);
    const c = recon.liabilityCrossChecks[0];
    // January of the earliest workbook: no prior December exists, so only the
    // same-month comparison applies — and it passes as "month".
    expect(c).toMatchObject({ liability: "Mortgage", month: 1, ok: true, matched: "month" });
    expect(c.deltaPct!).toBeLessThanOrEqual(0.5);
  });

  it("fails when the payoff diverges beyond 0.5% (and no prior month saves it)", async () => {
    const recon = await crossCheck({ payoffMode: "fail" });
    expect(recon.liabilityCrossChecksPassed).toBe(0);
    expect(recon.liabilityCrossChecks[0]).toMatchObject({ ok: false, matched: null });
    expect(recon.liabilityCrossChecks[0].deltaPct!).toBeGreaterThan(0.5);
  });

  it("passes via the previous month-end when the same month diverges (timing artifact)", async () => {
    const recon = await crossCheck({ payoffMode: "prior-month" });
    const c = recon.liabilityCrossChecks.find((x) => x.month === 2)!;
    // $301,000 is 0.67% off February's balance but 0.33% off January's — the
    // quote was written before that month's payment posted.
    expect(c).toMatchObject({ ok: true, matched: "prior-month", balanceCents: 30000000 });
    expect(c.deltaPct!).toBeLessThanOrEqual(0.5);
    expect(recon.liabilityCrossChecksPassed).toBe(recon.liabilityCrossChecksTotal);
  });

  it("fails a payoff line when neither the month nor the prior month has a balance", async () => {
    const recon = await crossCheck({ payoffMode: "missing" });
    const missing = recon.liabilityCrossChecks.find((c) => c.month === 4)!;
    expect(missing).toMatchObject({
      balanceCents: null, deltaPct: null, ok: false, matched: null,
    });
  });

  it("compares a January payoff against December of the previous year's workbook", async () => {
    // Hand-crafted minimal RawWorkbooks: 2023 carries only a December balance;
    // 2024's January payoff diverges 0.67% from January's own balance but
    // matches 2023's December exactly — cross-file prior-month lookup.
    const wb2023: RawWorkbook = {
      file: "2023.xlsx", year: 2023, gridSheet: "2023",
      gridRows: [], estimates: [],
      liabilities: [{ liability: "Mortgage", month: 12, cell: "B13", balanceCents: 30_000_000 }],
    };
    const wb2024: RawWorkbook = {
      file: "2024.xlsx", year: 2024, gridSheet: "2024",
      gridRows: [{
        label: "Mortgage",
        cells: [{ month: 1, cell: "B2", valueCents: null, comment: "Payoff Left - $300,000.00" }],
      }],
      estimates: [],
      liabilities: [{ liability: "Mortgage", month: 1, cell: "B2", balanceCents: 29_800_000 }],
    };
    const { reconciliation } = buildExtract({
      workbooks: [wb2024, wb2023], // deliberately unsorted — buildExtract orders by year
      mapping: fixtureMapping,
      overrides: fixtureOverrides,
      income: fixtureIncome,
    });
    expect(reconciliation.liabilityCrossChecks).toEqual([
      expect.objectContaining({
        ref: "2024.xlsx!2024!B2#1",
        month: 1,
        ok: true,
        matched: "prior-month",
        balanceCents: 30_000_000,
        deltaPct: 0,
      }),
    ]);
  });

  it("records no cross-check when there is no payoff metadata", async () => {
    const recon = await crossCheck({ payoffMode: "none" });
    expect(recon.liabilityCrossChecksTotal).toBe(0);
  });
});

describe("buildExtract — negative liability balance", () => {
  it("hard-errors, naming the cell", async () => {
    const wb = await readWorkbookBuffer(
      await buildFixtureWorkbook({ negativeBalance: true }),
      "2023.xlsx",
    );
    expect(() =>
      buildExtract({
        workbooks: [wb],
        mapping: fixtureMapping,
        overrides: fixtureOverrides,
        income: fixtureIncome,
      }),
    ).toThrow(/DebtsEquity!B2: liability "Mortgage" has a negative balance/);
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
