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
