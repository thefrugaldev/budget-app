import { describe, expect, it } from "vitest";

import { centsToDollars, parseAmountToCents } from "./money";

describe("parseAmountToCents", () => {
  it("parses whole dollars", () => {
    expect(parseAmountToCents("1234")).toBe(123400);
  });

  it("parses one and two decimal places exactly", () => {
    expect(parseAmountToCents("1234.5")).toBe(123450);
    expect(parseAmountToCents("1234.56")).toBe(123456);
    expect(parseAmountToCents("0.05")).toBe(5);
  });

  it("strips thousands commas", () => {
    expect(parseAmountToCents("9,999.99")).toBe(999999);
    expect(parseAmountToCents("1,000,000")).toBe(100000000);
  });

  it("sums a cell's lines without float drift", () => {
    // 0.1 + 0.2 in floating dollars is 0.30000000000000004; in cents it's exact.
    const cents = ["0.10", "0.20", "0.30"].map(parseAmountToCents);
    expect(cents.reduce((a, b) => a + b, 0)).toBe(60);
  });

  it("throws on a signed, $-prefixed, or malformed magnitude", () => {
    expect(() => parseAmountToCents("-5")).toThrow();
    expect(() => parseAmountToCents("$5")).toThrow();
    expect(() => parseAmountToCents("5.123")).toThrow();
    expect(() => parseAmountToCents("abc")).toThrow();
  });
});

describe("centsToDollars", () => {
  it("converts integer cents to a dollars number", () => {
    expect(centsToDollars(123450)).toBe(1234.5);
    expect(centsToDollars(-4000)).toBe(-40);
    expect(centsToDollars(5)).toBe(0.05);
  });
});
