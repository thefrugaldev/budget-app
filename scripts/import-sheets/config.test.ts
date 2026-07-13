import { describe, expect, it } from "vitest";

import { parseIncome, parseMapping, parseOverrides } from "./config";

describe("parseMapping", () => {
  const ok = {
    categories: [
      { canonicalName: "Groceries", kind: "expense", icon: "ShoppingCart", aliases: ["Groceries", "Food"] },
    ],
    vendorRewrites: [{ match: "AMZN", to: "Amazon", mode: "regex" }],
  };

  it("parses a well-formed mapping", () => {
    const m = parseMapping(ok);
    expect(m.categories[0].aliases).toEqual(["Groceries", "Food"]);
    expect(m.vendorRewrites[0].mode).toBe("regex");
  });

  it("defaults a rewrite mode to exact", () => {
    const m = parseMapping({ ...ok, vendorRewrites: [{ match: "a", to: "b" }] });
    expect(m.vendorRewrites[0].mode).toBe("exact");
  });

  it("rejects an invalid kind", () => {
    expect(() =>
      parseMapping({ categories: [{ canonicalName: "X", kind: "bogus", icon: "I", aliases: ["X"] }] }),
    ).toThrow(/kind/);
  });

  it("rejects empty aliases", () => {
    expect(() =>
      parseMapping({ categories: [{ canonicalName: "X", kind: "expense", icon: "I", aliases: [] }] }),
    ).toThrow(/aliases/);
  });

  it("rejects an alias claimed by two categories", () => {
    expect(() =>
      parseMapping({
        categories: [
          { canonicalName: "A", kind: "expense", icon: "I", aliases: ["Shared"] },
          { canonicalName: "B", kind: "expense", icon: "I", aliases: ["shared"] },
        ],
      }),
    ).toThrow(/claimed by both/);
  });

  it("defaults liabilities and skipRows to empty when absent", () => {
    const m = parseMapping(ok);
    expect(m.liabilities).toEqual([]);
    expect(m.skipRows).toEqual([]);
  });

  it("parses liabilities and skipRows", () => {
    const m = parseMapping({
      ...ok,
      liabilities: [{ canonicalName: "Mortgage", aliases: ["Mortgage", "Home Loan"] }],
      skipRows: ["Total", "Remaining After Expenses & Savings"],
    });
    expect(m.liabilities).toEqual([
      { canonicalName: "Mortgage", aliases: ["Mortgage", "Home Loan"] },
    ]);
    expect(m.skipRows).toEqual(["Total", "Remaining After Expenses & Savings"]);
  });

  it("rejects a liability with empty aliases", () => {
    expect(() =>
      parseMapping({ ...ok, liabilities: [{ canonicalName: "Mortgage", aliases: [] }] }),
    ).toThrow(/liabilities\[0\].aliases must be non-empty/);
  });

  it("rejects a liability alias claimed by two liabilities", () => {
    expect(() =>
      parseMapping({
        ...ok,
        liabilities: [
          { canonicalName: "Mortgage", aliases: ["Home Loan"] },
          { canonicalName: "Second", aliases: ["home loan"] },
        ],
      }),
    ).toThrow(/liability alias .* claimed by both/);
  });

  it("rejects a skipRow that is also a category alias", () => {
    expect(() =>
      parseMapping({ ...ok, skipRows: ["food"] }), // "Food" is a Groceries alias
    ).toThrow(/can't be both mapped and skipped/);
  });
});

describe("parseOverrides", () => {
  it("defaults to empty when absent", () => {
    expect(parseOverrides(undefined)).toEqual({ cells: {}, refundKeywords: [] });
  });

  it("parses each override action", () => {
    const o = parseOverrides({
      cells: {
        "2023.xlsx!2023!B2": [
          { line: 1, action: "skip", reason: "double-count" },
          { line: 2, action: "sign-flip", reason: "refund" },
          { line: 3, action: "set-amount", amountCents: 500, reason: "typo" },
          { line: 4, action: "set-date", month: 1, day: 5, reason: "fix" },
        ],
      },
      refundKeywords: ["refund"],
    });
    expect(o.cells["2023.xlsx!2023!B2"]).toHaveLength(4);
    expect(o.refundKeywords).toEqual(["refund"]);
  });

  it("rejects an unknown action", () => {
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "explode", reason: "x" }] } }),
    ).toThrow(/action invalid/);
  });

  it("range-checks a set-date month and day", () => {
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "set-date", month: 13, day: 1, reason: "x" }] } }),
    ).toThrow(/month must be an integer 1–12/);
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "set-date", month: 1, day: 0, reason: "x" }] } }),
    ).toThrow(/day must be an integer 1–31/);
  });

  it("parses an add-line with all optional fields", () => {
    const o = parseOverrides({
      cells: {
        "2020.xlsx!2020!B9": [
          { line: 2, action: "add-line", day: 15, month: 1, amountCents: 4200, vendor: "Power Co", note: "autopay", reason: "comment is 'Paid (1/15)'" },
        ],
      },
    });
    expect(o.cells["2020.xlsx!2020!B9"][0]).toEqual({
      line: 2, action: "add-line", day: 15, month: 1, amountCents: 4200,
      vendor: "Power Co", note: "autopay", reason: "comment is 'Paid (1/15)'",
    });
  });

  it("parses a minimal add-line (month/vendor/note omitted)", () => {
    const o = parseOverrides({
      cells: { k: [{ line: 3, action: "add-line", day: 1, amountCents: -4200, reason: "unitemized remainder" }] },
    });
    expect(o.cells.k[0]).toEqual({
      line: 3, action: "add-line", day: 1, amountCents: -4200, reason: "unitemized remainder",
    });
  });

  it("range-checks an add-line day and month and rejects fractional cents", () => {
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "add-line", day: 32, amountCents: 100, reason: "x" }] } }),
    ).toThrow(/day must be an integer 1–31/);
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "add-line", day: 1, month: 0, amountCents: 100, reason: "x" }] } }),
    ).toThrow(/month must be an integer 1–12/);
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "add-line", day: 1, amountCents: 10.5, reason: "x" }] } }),
    ).toThrow(/amountCents must be an integer/);
  });

  it("rejects an add-line with an empty reason or blank vendor", () => {
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "add-line", day: 1, amountCents: 100, reason: "" }] } }),
    ).toThrow(/reason/);
    expect(() =>
      parseOverrides({ cells: { k: [{ line: 1, action: "add-line", day: 1, amountCents: 100, vendor: "", reason: "x" }] } }),
    ).toThrow(/vendor/);
  });
});

describe("parseIncome", () => {
  it("parses sources with per-year gross", () => {
    const inc = parseIncome({
      sources: [
        { canonicalName: "Salary", icon: "Banknote", payCadence: "bi-weekly", annualGrossByYear: { "2023": 120000 } },
      ],
    });
    expect(inc.sources[0].annualGrossByYear["2023"]).toBe(120000);
  });

  it("rejects a bad cadence", () => {
    expect(() =>
      parseIncome({ sources: [{ canonicalName: "S", icon: "I", payCadence: "hourly", annualGrossByYear: {} }] }),
    ).toThrow(/payCadence/);
  });

  it("rejects a non-year gross key", () => {
    expect(() =>
      parseIncome({
        sources: [{ canonicalName: "S", icon: "I", payCadence: "monthly", annualGrossByYear: { soon: 1 } }],
      }),
    ).toThrow(/not a year/);
  });
});
