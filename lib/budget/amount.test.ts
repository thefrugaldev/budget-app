import { describe, expect, it } from "vitest";

import { formatAmount, padOnBlur, sanitizeAmount } from "./amount";

describe("sanitizeAmount — cents (explicit decimal)", () => {
  it("keeps digits as dollars, with an explicit decimal for cents", () => {
    expect(sanitizeAmount("1234", "cents")).toBe("1234");
    expect(sanitizeAmount("1234.5", "cents")).toBe("1234.5");
    expect(sanitizeAmount("1234.56", "cents")).toBe("1234.56");
  });

  it("preserves a trailing dot so the user can type into the cents", () => {
    expect(sanitizeAmount("1234.", "cents")).toBe("1234.");
  });

  it("caps decimals at two and collapses extra dots", () => {
    expect(sanitizeAmount("12.345", "cents")).toBe("12.34");
    expect(sanitizeAmount("12.3.4", "cents")).toBe("12.34");
  });

  it("strips $, commas, and leading zeros from a formatted value", () => {
    expect(sanitizeAmount("$1,234.56", "cents")).toBe("1234.56");
    expect(sanitizeAmount("007", "cents")).toBe("7");
    expect(sanitizeAmount("0.5", "cents")).toBe("0.5");
  });

  it("is empty for empty / non-numeric input", () => {
    expect(sanitizeAmount("", "cents")).toBe("");
    expect(sanitizeAmount("abc", "cents")).toBe("");
  });

  it("bounds the integer part by maxIntDigits", () => {
    expect(sanitizeAmount("123456789012.99", "cents", 7)).toBe("1234567.99");
  });
});

describe("sanitizeAmount — whole (no decimal)", () => {
  it("drops any decimal and keeps grouping-free digits", () => {
    expect(sanitizeAmount("85000", "whole")).toBe("85000");
    expect(sanitizeAmount("85000.49", "whole")).toBe("8500049"); // dot removed, digits kept
    expect(sanitizeAmount("$85,000", "whole")).toBe("85000");
  });
});

describe("formatAmount — live comma grouping", () => {
  it("groups the integer part and shows decimals as typed", () => {
    expect(formatAmount("1234", "cents")).toBe("$1,234");
    expect(formatAmount("1234.", "cents")).toBe("$1,234.");
    expect(formatAmount("1234.5", "cents")).toBe("$1,234.5");
    expect(formatAmount("1234.56", "cents")).toBe("$1,234.56");
    expect(formatAmount("0.5", "cents")).toBe("$0.5");
  });

  it("groups whole dollars with no decimal", () => {
    expect(formatAmount("85000", "whole")).toBe("$85,000");
    expect(formatAmount("800", "whole")).toBe("$800");
  });

  it("is empty for an empty value so the placeholder shows", () => {
    expect(formatAmount("", "cents")).toBe("");
    expect(formatAmount("", "whole")).toBe("");
  });
});

describe("padOnBlur", () => {
  it("pads typed cents to two digits", () => {
    expect(padOnBlur("1234.5", "cents")).toBe("1234.50");
    expect(padOnBlur("0.5", "cents")).toBe("0.50");
  });

  it("drops a lone trailing dot back to whole dollars", () => {
    expect(padOnBlur("1234.", "cents")).toBe("1234");
  });

  it("leaves whole-dollar cents entries clean (no .00)", () => {
    expect(padOnBlur("1234", "cents")).toBe("1234");
  });

  it("leaves complete and whole-precision values untouched", () => {
    expect(padOnBlur("1234.56", "cents")).toBe("1234.56");
    expect(padOnBlur("85000", "whole")).toBe("85000");
    expect(padOnBlur("", "cents")).toBe("");
  });
});

describe("round-trip: sanitize -> format is stable", () => {
  it("re-sanitising a formatted value is idempotent", () => {
    for (const v of ["1234", "1234.5", "1234.56", "0.5", "85000"]) {
      const formatted = formatAmount(v, "cents");
      expect(sanitizeAmount(formatted, "cents")).toBe(v);
    }
  });
});
