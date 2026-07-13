import { describe, expect, it } from "vitest";

import { buildReconciliationReport, buildVendorReport } from "./reports";
import type { CellReconcileReport, LiabilityCrossCheck } from "./manifest-types";

function cell(
  ref: string,
  status: CellReconcileReport["status"],
): CellReconcileReport {
  return {
    ref,
    category: "X",
    month: 1,
    status,
    cellValueCents: 0,
    sumCents: 0,
    deltaCents: 0,
    autoFlippedLines: [],
  };
}

describe("buildReconciliationReport", () => {
  it("counts each status and orders unreconciled first", () => {
    const report = buildReconciliationReport([
      cell("c", "exact"),
      cell("a", "unreconciled"),
      cell("b", "reconciled-by-flip"),
      cell("d", "exact"),
    ]);
    expect(report).toMatchObject({
      totalCells: 4,
      exact: 2,
      reconciledByFlip: 1,
      unreconciled: 1,
    });
    expect(report.cells.map((c) => c.status)).toEqual([
      "unreconciled",
      "reconciled-by-flip",
      "exact",
      "exact",
    ]);
  });

  it("counts and orders liability cross-checks, failures first", () => {
    const check = (ref: string, ok: boolean): LiabilityCrossCheck => ({
      ref, liability: "Mortgage", month: 1, payoffCents: 100,
      balanceCents: 100, deltaPct: 0, ok,
    });
    const report = buildReconciliationReport(
      [],
      [check("c", true), check("a", false), check("b", true)],
    );
    expect(report.liabilityCrossChecksTotal).toBe(3);
    expect(report.liabilityCrossChecksPassed).toBe(2);
    expect(report.liabilityCrossChecks.map((c) => c.ref)).toEqual(["a", "b", "c"]);
  });
});

describe("buildVendorReport", () => {
  it("sorts by count desc, then name", () => {
    const tally = new Map([
      ["Costco", { count: 2, totalCents: 10000 }],
      ["Safeway", { count: 1, totalCents: 5000 }],
      ["Amazon", { count: 1, totalCents: 2500 }],
    ]);
    expect(buildVendorReport(tally).vendors).toEqual([
      { vendor: "Costco", count: 2, totalCents: 10000 },
      { vendor: "Amazon", count: 1, totalCents: 2500 },
      { vendor: "Safeway", count: 1, totalCents: 5000 },
    ]);
  });
});
