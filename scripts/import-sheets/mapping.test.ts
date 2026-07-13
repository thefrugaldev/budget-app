import { describe, expect, it } from "vitest";

import { isSkipRow, resolveCategory, resolveLiability, rewriteVendor } from "./mapping";
import type { CategoryMapping } from "./types";

const mapping: CategoryMapping = {
  categories: [
    {
      canonicalName: "Groceries",
      kind: "expense",
      icon: "ShoppingCart",
      // A rename chain: "Food" (early years) → "Groceries".
      aliases: ["Groceries", "Food", "Grocery"],
    },
    {
      canonicalName: "Brokerage",
      kind: "savings",
      icon: "TrendingUp",
      aliases: ["Savings From Checking (Brokerage)", "External Savings (Brokerage)"],
    },
  ],
  vendorRewrites: [
    { match: "AMZN Mktp US", to: "Amazon", mode: "regex" },
    { match: "sq *blue bottle", to: "Blue Bottle", mode: "exact" },
  ],
  liabilities: [
    { canonicalName: "Mortgage", aliases: ["Mortgage", "Home Loan"] },
    { canonicalName: "Student Loans", aliases: ["Student Loans (Total)"] },
  ],
  skipRows: ["Total", "Remaining After Expenses & Savings", "Tennis Income"],
};

describe("resolveCategory", () => {
  it("resolves a canonical label", () => {
    expect(resolveCategory("Groceries", mapping)?.canonicalName).toBe("Groceries");
  });

  it("collapses a rename chain to one canonical category", () => {
    expect(resolveCategory("Food", mapping)?.canonicalName).toBe("Groceries");
    expect(resolveCategory("Grocery", mapping)?.canonicalName).toBe("Groceries");
  });

  it("merges paired savings rows into one savings category", () => {
    expect(
      resolveCategory("Savings From Checking (Brokerage)", mapping)?.canonicalName,
    ).toBe("Brokerage");
    expect(
      resolveCategory("External Savings (Brokerage)", mapping)?.canonicalName,
    ).toBe("Brokerage");
  });

  it("matches case-insensitively after trimming", () => {
    expect(resolveCategory("  food  ", mapping)?.canonicalName).toBe("Groceries");
  });

  it("returns null for an unmapped or empty label", () => {
    expect(resolveCategory("Crypto", mapping)).toBeNull();
    expect(resolveCategory("   ", mapping)).toBeNull();
  });
});

describe("resolveLiability", () => {
  it("renames a mapped header to its canonical name", () => {
    expect(resolveLiability("Home Loan", mapping)).toBe("Mortgage");
    expect(resolveLiability("Student Loans (Total)", mapping)).toBe("Student Loans");
  });

  it("matches case-insensitively after trimming", () => {
    expect(resolveLiability("  home loan ", mapping)).toBe("Mortgage");
  });

  it("passes an unmapped header through as its trimmed self (no error)", () => {
    expect(resolveLiability("  Auto Loan  ", mapping)).toBe("Auto Loan");
  });
});

describe("isSkipRow", () => {
  it("matches a declared skipRow (trim/case-insensitive)", () => {
    expect(isSkipRow("Total", mapping)).toBe(true);
    expect(isSkipRow("  tennis income ", mapping)).toBe(true);
  });

  it("is false for a mapped or unknown label and for empty", () => {
    expect(isSkipRow("Groceries", mapping)).toBe(false);
    expect(isSkipRow("Whatever", mapping)).toBe(false);
    expect(isSkipRow("   ", mapping)).toBe(false);
  });
});

describe("rewriteVendor", () => {
  it("replaces a whole vendor on an exact (case-insensitive) match", () => {
    expect(rewriteVendor("SQ *Blue Bottle", mapping.vendorRewrites)).toBe(
      "Blue Bottle",
    );
  });

  it("applies a regex rewrite", () => {
    expect(rewriteVendor("AMZN Mktp US*2Z4", mapping.vendorRewrites)).toBe(
      "Amazon*2Z4",
    );
  });

  it("leaves an unmatched vendor unchanged", () => {
    expect(rewriteVendor("Costco", mapping.vendorRewrites)).toBe("Costco");
  });

  it("passes a null vendor through", () => {
    expect(rewriteVendor(null, mapping.vendorRewrites)).toBeNull();
  });
});
