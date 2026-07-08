import { describe, expect, it } from "vitest";

import { reconcileCell } from "./reconcile";
import type { ParsedTransactionLine } from "./types";

function line(
  amountCents: number,
  extra: Partial<ParsedTransactionLine> = {},
): ParsedTransactionLine {
  return {
    kind: "transaction",
    month: 1,
    day: 1,
    amountCents,
    vendor: null,
    note: null,
    ...extra,
  };
}

describe("reconcileCell — exact", () => {
  it("reconciles when lines sum to the cell value", () => {
    const result = reconcileCell({
      cellValueCents: 3000,
      lines: [line(1000), line(2000)],
    });
    expect(result.status).toBe("exact");
    expect(result.sumCents).toBe(3000);
    expect(result.deltaCents).toBe(0);
    expect(result.effectiveLines).toHaveLength(2);
  });

  it("reports the delta when a cell does not reconcile", () => {
    const result = reconcileCell({
      cellValueCents: 3000,
      lines: [line(1000), line(1500)],
    });
    expect(result.status).toBe("unreconciled");
    expect(result.sumCents).toBe(2500);
    expect(result.deltaCents).toBe(-500);
  });
});

describe("reconcileCell — explicit overrides", () => {
  it("skips a line (annual payment already captured as monthly deposits)", () => {
    const result = reconcileCell({
      cellValueCents: 1000,
      lines: [line(1000), line(6000, { note: "annual HOA" })],
      overrides: [{ line: 2, action: "skip", reason: "double-count" }],
    });
    expect(result.status).toBe("exact");
    expect(result.effectiveLines).toHaveLength(1);
  });

  it("sign-flips a line via an override", () => {
    const result = reconcileCell({
      cellValueCents: 500,
      lines: [line(1000), line(500)],
      overrides: [{ line: 2, action: "sign-flip", reason: "refund" }],
    });
    expect(result.status).toBe("exact");
    expect(result.effectiveLines[1].amountCents).toBe(-500);
  });

  it("corrects an amount via an override", () => {
    const result = reconcileCell({
      cellValueCents: 1200,
      lines: [line(1000), line(999)],
      overrides: [{ line: 2, action: "set-amount", amountCents: 200, reason: "typo" }],
    });
    expect(result.status).toBe("exact");
  });
});

describe("reconcileCell — conditional keyword sign-flip", () => {
  it("flips positive refund-keyword lines when that reconciles exactly", () => {
    // Two $50 lines sum to +100, but the cell is 0 → flipping the refund line
    // (−50) plus a real +50 spend reconciles.
    const result = reconcileCell({
      cellValueCents: 0,
      lines: [line(5000, { vendor: "Costco" }), line(5000, { note: "refund from Target" })],
      refundKeywords: ["refund", "reimbursement"],
    });
    expect(result.status).toBe("reconciled-by-flip");
    expect(result.autoFlippedLines).toEqual([2]);
    expect(result.sumCents).toBe(0);
  });

  it("does not flip when flipping fails to reconcile", () => {
    const result = reconcileCell({
      cellValueCents: 9999,
      lines: [line(5000, { note: "refund" })],
      refundKeywords: ["refund"],
    });
    expect(result.status).toBe("unreconciled");
    expect(result.autoFlippedLines).toEqual([]);
  });

  it("ignores keywords on already-negative lines", () => {
    const result = reconcileCell({
      cellValueCents: -5000,
      lines: [line(-5000, { note: "refund" })],
      refundKeywords: ["refund"],
    });
    expect(result.status).toBe("exact");
  });
});
