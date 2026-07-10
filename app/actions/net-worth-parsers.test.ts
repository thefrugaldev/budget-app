import { describe, expect, it } from "vitest";

import {
  parseAccountClass,
  parseAccountId,
  parseAccountName,
  parseAssetKind,
  parseBalanceAmount,
  parseCheckInDate,
  parsePriceOverride,
  parseQuantity,
  parseTicker,
} from "./net-worth-parsers";

describe("parseAccountName", () => {
  it("trims a valid name", () => {
    expect(parseAccountName("  Brokerage  ")).toBe("Brokerage");
  });

  it("rejects empty / non-string input", () => {
    expect(() => parseAccountName("")).toThrow(/required/i);
    expect(() => parseAccountName("   ")).toThrow(/required/i);
    expect(() => parseAccountName(null)).toThrow(/required/i);
  });
});

describe("parseAccountId", () => {
  it("trims a valid id", () => {
    expect(parseAccountId(" abc ")).toBe("abc");
  });

  it("rejects blank input", () => {
    expect(() => parseAccountId("")).toThrow(/required/i);
    expect(() => parseAccountId(null)).toThrow(/required/i);
  });
});

describe("parseAccountClass", () => {
  it("accepts the two classes", () => {
    expect(parseAccountClass("asset")).toBe("asset");
    expect(parseAccountClass("liability")).toBe("liability");
  });

  it("rejects anything else", () => {
    expect(() => parseAccountClass("investment")).toThrow(/asset or liability/i);
    expect(() => parseAccountClass("")).toThrow(/asset or liability/i);
    expect(() => parseAccountClass(null)).toThrow(/asset or liability/i);
  });
});

describe("parseAssetKind", () => {
  it("accepts the three asset kinds", () => {
    expect(parseAssetKind("cash")).toBe("cash");
    expect(parseAssetKind("investment")).toBe("investment");
    expect(parseAssetKind("property")).toBe("property");
  });

  it("rejects anything else", () => {
    expect(() => parseAssetKind("liability")).toThrow(/cash, investment, or property/i);
    expect(() => parseAssetKind("")).toThrow(/cash, investment, or property/i);
  });
});

describe("parseBalanceAmount", () => {
  it("accepts a bare number and a currency string", () => {
    expect(parseBalanceAmount(4200)).toBe(4200);
    expect(parseBalanceAmount("$4,200.50")).toBe(4200.5);
  });

  it("allows zero (a cash account can hold $0)", () => {
    expect(parseBalanceAmount("0")).toBe(0);
    expect(parseBalanceAmount(0)).toBe(0);
  });

  it("rejects negatives, non-numeric, and empty input", () => {
    expect(() => parseBalanceAmount("-5")).toThrow(/negative/i);
    expect(() => parseBalanceAmount(-5)).toThrow(/negative/i);
    expect(() => parseBalanceAmount("abc")).toThrow(/number/i);
    expect(() => parseBalanceAmount("")).toThrow(/required/i);
    expect(() => parseBalanceAmount(null)).toThrow(/required/i);
  });

  it("rejects scientific notation and other malformed shapes (no silent coercion)", () => {
    // A `[^0-9.-]` strip would turn "1e5" into 15; the whitelist rejects it.
    expect(() => parseBalanceAmount("1e5")).toThrow(/number/i);
    expect(() => parseBalanceAmount("5.5.5")).toThrow(/number/i);
    expect(() => parseBalanceAmount("--5")).toThrow(/number/i);
  });
});

describe("parseTicker", () => {
  it("upper-cases and trims", () => {
    expect(parseTicker("  aapl ")).toBe("AAPL");
  });

  it("rejects blank input", () => {
    expect(() => parseTicker("")).toThrow(/required/i);
    expect(() => parseTicker(null)).toThrow(/required/i);
  });
});

describe("parseQuantity", () => {
  it("accepts a decimal quantity", () => {
    expect(parseQuantity("10.5")).toBe(10.5);
    expect(parseQuantity(3)).toBe(3);
  });

  it("allows zero", () => {
    expect(parseQuantity("0")).toBe(0);
  });

  it("rejects negatives and non-numeric input", () => {
    expect(() => parseQuantity("-1")).toThrow(/negative/i);
    expect(() => parseQuantity("abc")).toThrow(/number/i);
    expect(() => parseQuantity("")).toThrow(/required/i);
  });
});

describe("parsePriceOverride", () => {
  it("returns undefined for an absent / empty value (use the feed)", () => {
    expect(parsePriceOverride(undefined)).toBeUndefined();
    expect(parsePriceOverride(null)).toBeUndefined();
    expect(parsePriceOverride("")).toBeUndefined();
    expect(parsePriceOverride("   ")).toBeUndefined();
  });

  it("parses a present override", () => {
    expect(parsePriceOverride("150")).toBe(150);
    expect(parsePriceOverride(150)).toBe(150);
  });

  it("allows zero but rejects a negative override", () => {
    expect(parsePriceOverride("0")).toBe(0);
    expect(() => parsePriceOverride("-1")).toThrow(/negative/i);
  });
});

describe("parseCheckInDate", () => {
  it("returns undefined for an absent date (action defaults to today)", () => {
    expect(parseCheckInDate(undefined)).toBeUndefined();
    expect(parseCheckInDate(null)).toBeUndefined();
    expect(parseCheckInDate("")).toBeUndefined();
  });

  it("accepts a well-formed ISO date", () => {
    expect(parseCheckInDate("2026-07-10")).toBe("2026-07-10");
  });

  it("rejects a malformed or impossible date", () => {
    expect(() => parseCheckInDate("07/10/2026")).toThrow(/ISO calendar date/i);
    expect(() => parseCheckInDate("2026-02-30")).toThrow(/real calendar date/i);
  });
});
