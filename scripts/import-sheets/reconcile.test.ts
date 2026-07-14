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

describe("reconcileCell — add-line overrides", () => {
  it("reconciles a cell with zero parsed lines via a synthetic line (autopay case)", () => {
    // The comment was "Paid (1/15)" — unparseable, so no parsed lines — and the
    // cell value IS the single transaction amount.
    const result = reconcileCell({
      cellValueCents: 4200,
      lines: [],
      overrides: [
        { line: 1, action: "add-line", day: 15, amountCents: 4200, vendor: "Power Co", reason: "autopay note" },
      ],
      budgetMonth: 1,
    });
    expect(result.status).toBe("exact");
    expect(result.effectiveLines).toEqual([
      { kind: "transaction", month: 1, day: 15, amountCents: 4200, vendor: "Power Co", note: null, line: 1 },
    ]);
  });

  it("reconciles an unitemized remainder alongside parsed lines", () => {
    const result = reconcileCell({
      cellValueCents: 10000,
      lines: [line(3000)],
      overrides: [
        { line: 2, action: "add-line", day: 28, amountCents: 7000, note: "remainder", reason: "unitemized" },
      ],
      budgetMonth: 1,
    });
    expect(result.status).toBe("exact");
    expect(result.effectiveLines.map((l) => l.line)).toEqual([1, 2]);
    expect(result.effectiveLines[1].amountCents).toBe(7000);
  });

  it("stays unreconciled when parsed + added lines still miss the cell value", () => {
    const result = reconcileCell({
      cellValueCents: 10000,
      lines: [line(3000)],
      overrides: [{ line: 2, action: "add-line", day: 1, amountCents: 100, reason: "wrong" }],
      budgetMonth: 1,
    });
    expect(result.status).toBe("unreconciled");
    expect(result.sumCents).toBe(3100);
  });

  it("uses the override's own month over the budget month", () => {
    const result = reconcileCell({
      cellValueCents: 500,
      lines: [],
      overrides: [{ line: 1, action: "add-line", day: 3, month: 12, amountCents: 500, reason: "prior-month bill" }],
      budgetMonth: 1,
    });
    expect(result.effectiveLines[0]).toMatchObject({ month: 12, day: 3 });
  });

  it("throws when the declared line collides with a parsed line's index", () => {
    expect(() =>
      reconcileCell({
        cellValueCents: 2000,
        lines: [line(1000)],
        overrides: [{ line: 1, action: "add-line", day: 1, amountCents: 1000, reason: "x" }],
        budgetMonth: 1,
      }),
    ).toThrow(/collides with a parsed line/);
  });

  it("throws when neither the override nor the caller provides a month", () => {
    expect(() =>
      reconcileCell({
        cellValueCents: 500,
        lines: [],
        overrides: [{ line: 1, action: "add-line", day: 1, amountCents: 500, reason: "x" }],
      }),
    ).toThrow(/no month/);
  });

  it("never auto-flips an added line, even on a keyword match", () => {
    // If the added +5000 were flippable, −5000 would reconcile the 0 cell; the
    // curated sign must win, so the cell stays unreconciled instead.
    const result = reconcileCell({
      cellValueCents: 0,
      lines: [],
      overrides: [
        { line: 1, action: "add-line", day: 1, amountCents: 5000, note: "refund", reason: "curated sign" },
      ],
      refundKeywords: ["refund"],
      budgetMonth: 1,
    });
    expect(result.status).toBe("unreconciled");
    expect(result.autoFlippedLines).toEqual([]);
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
