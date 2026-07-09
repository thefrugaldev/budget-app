import { describe, expect, it } from "vitest";

import { assertIconsResolve, findUnknownIcons } from "./icon-validate";
import type { CategoryMapping, IncomeConfig } from "./types";

const noIncome: IncomeConfig = { sources: [] };

describe("findUnknownIcons", () => {
  it("passes when every icon resolves in the app catalog", () => {
    const mapping: CategoryMapping = {
      categories: [
        { canonicalName: "Groceries", kind: "expense", icon: "ShoppingCart", aliases: ["Groceries"] },
      ],
      vendorRewrites: [],
    };
    expect(findUnknownIcons(mapping, noIncome)).toEqual([]);
  });

  it("names the offending category and its bad icon", () => {
    const mapping: CategoryMapping = {
      categories: [
        { canonicalName: "Groceries", kind: "expense", icon: "NotARealLucideIcon", aliases: ["Groceries"] },
      ],
      vendorRewrites: [],
    };
    expect(findUnknownIcons(mapping, noIncome)).toEqual([
      'category "Groceries": NotARealLucideIcon',
    ]);
  });

  it("checks income-source icons too", () => {
    const income: IncomeConfig = {
      sources: [
        { canonicalName: "Salary", icon: "Nope", payCadence: "monthly", annualGrossByYear: {} },
      ],
    };
    expect(findUnknownIcons({ categories: [], vendorRewrites: [] }, income)).toEqual([
      'income "Salary": Nope',
    ]);
  });
});

describe("assertIconsResolve", () => {
  it("throws an aggregated error listing all unknown icons", () => {
    const mapping: CategoryMapping = {
      categories: [{ canonicalName: "X", kind: "expense", icon: "Bogus", aliases: ["X"] }],
      vendorRewrites: [],
    };
    expect(() => assertIconsResolve(mapping, noIncome)).toThrow(/Bogus/);
  });
});
