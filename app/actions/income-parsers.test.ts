import { describe, expect, it } from "vitest";

import { parseYearly } from "./income-parsers";

describe("parseYearly", () => {
  it("accepts a bare numeric string", () => {
    expect(parseYearly("90000")).toBe(90000);
  });

  it("accepts a currency-formatted string with $ and commas", () => {
    expect(parseYearly("$90,000")).toBe(90000);
  });

  it("accepts decimals", () => {
    expect(parseYearly("90000.50")).toBe(90000.5);
  });

  it("strips whitespace and stray formatting", () => {
    expect(parseYearly(" $ 90,000.00 ")).toBe(90000);
  });

  it("rejects empty input", () => {
    expect(() => parseYearly("")).toThrow(/required/i);
    expect(() => parseYearly("   ")).toThrow(/required/i);
  });

  it("rejects a non-string FormData value (file upload, missing key)", () => {
    expect(() => parseYearly(null)).toThrow(/required/i);
  });

  it("rejects non-numeric input", () => {
    expect(() => parseYearly("abc")).toThrow(/number/i);
  });

  it("rejects zero", () => {
    expect(() => parseYearly("0")).toThrow(/greater than zero/i);
  });

  it("rejects negative values", () => {
    expect(() => parseYearly("-100")).toThrow(/greater than zero/i);
  });
});
