import { describe, expect, it } from "vitest";

import {
  parseAssumptionOverrides,
  parseBirthYear,
  parseInflation,
  parseMonthlyContribution,
  parseMonthlyRetirementSpend,
  parseNominalReturn,
  parseSafeWithdrawalRate,
  parseTraditionalRetirementAge,
} from "./fire-assumptions-parsers";

describe("optional-knob parsers", () => {
  it("treat blank / absent as not-overridden (undefined)", () => {
    expect(parseMonthlyRetirementSpend("")).toBeUndefined();
    expect(parseMonthlyContribution("  ")).toBeUndefined();
    expect(parseNominalReturn(null)).toBeUndefined();
    expect(parseInflation(undefined)).toBeUndefined();
    expect(parseSafeWithdrawalRate("")).toBeUndefined();
    expect(parseBirthYear("")).toBeUndefined();
    expect(parseTraditionalRetirementAge("")).toBeUndefined();
  });

  it("keep an explicit zero for the money knobs (coast case, story 10)", () => {
    expect(parseMonthlyContribution("0")).toBe(0);
    expect(parseMonthlyContribution(0)).toBe(0);
    expect(parseMonthlyRetirementSpend("0")).toBe(0);
  });

  it("parse currency-formatted and bare numeric input", () => {
    expect(parseMonthlyRetirementSpend("$4,200.50")).toBe(4200.5);
    expect(parseMonthlyRetirementSpend(4200.5)).toBe(4200.5);
    expect(parseNominalReturn("7%")).toBe(7);
  });

  it("accept mid-typed leading/trailing-dot decimals", () => {
    expect(parseMonthlyRetirementSpend("3.")).toBe(3);
    expect(parseNominalReturn(".5")).toBe(0.5);
  });

  it("reject non-numeric / silently-coercing shapes", () => {
    expect(() => parseMonthlyRetirementSpend("1e5")).toThrow(/must be a number/i);
    expect(() => parseNominalReturn("abc")).toThrow(/must be a number/i);
    expect(() => parseNominalReturn("1.2.3")).toThrow(/must be a number/i);
    expect(() => parseMonthlyRetirementSpend(".")).toThrow(/must be a number/i);
  });
});

describe("parseNominalReturn / parseInflation", () => {
  it("accept 0–100 and reject out of range", () => {
    expect(parseNominalReturn("0")).toBe(0);
    expect(parseInflation("3")).toBe(3);
    expect(() => parseNominalReturn("-1")).toThrow(/between 0 and 100/i);
    expect(() => parseInflation("150")).toThrow(/between 0 and 100/i);
  });
});

describe("parseSafeWithdrawalRate", () => {
  it("accepts a positive percentage", () => {
    expect(parseSafeWithdrawalRate("4")).toBe(4);
    expect(parseSafeWithdrawalRate("3.5")).toBe(3.5);
  });

  it("rejects zero (no finite FIRE number) and out-of-range", () => {
    expect(() => parseSafeWithdrawalRate("0")).toThrow(/greater than 0/i);
    expect(() => parseSafeWithdrawalRate("101")).toThrow(/between 0 and 100/i);
  });
});

describe("parseBirthYear", () => {
  it("accepts a plausible four-digit year", () => {
    expect(parseBirthYear("1990", 2026)).toBe(1990);
  });

  it("rejects a future year and a pre-1900 year (carried-forward #149 review)", () => {
    expect(() => parseBirthYear("2027", 2026)).toThrow(/between 1900 and 2026/i);
    expect(() => parseBirthYear("1899", 2026)).toThrow(/between 1900 and 2026/i);
  });

  it("rejects a non-integer year", () => {
    expect(() => parseBirthYear("1990.5", 2026)).toThrow(/whole number/i);
  });
});

describe("parseTraditionalRetirementAge", () => {
  it("accepts a whole age in range and rejects nonsense", () => {
    expect(parseTraditionalRetirementAge("65")).toBe(65);
    expect(() => parseTraditionalRetirementAge("0")).toThrow(/between 1 and 120/i);
    expect(() => parseTraditionalRetirementAge("65.5")).toThrow(/whole number/i);
  });
});

describe("parseAssumptionOverrides", () => {
  const field =
    (values: Record<string, unknown>) =>
    (name: string): unknown =>
      values[name];

  it("collects only the filled-in knobs (blank ones are omitted, not undefined)", () => {
    const overrides = parseAssumptionOverrides(
      field({
        monthlyRetirementSpend: "5000",
        birthYear: "1990",
        // everything else blank
        monthlyContribution: "",
        nominalReturn: "",
        inflation: "",
        safeWithdrawalRate: "",
        traditionalRetirementAge: "",
      }),
      2026,
    );
    expect(overrides).toEqual({ monthlyRetirementSpend: 5000, birthYear: 1990 });
    expect("monthlyContribution" in overrides).toBe(false);
  });

  it("keeps an explicit zero contribution while omitting blanks", () => {
    const overrides = parseAssumptionOverrides(field({ monthlyContribution: "0" }), 2026);
    expect(overrides).toEqual({ monthlyContribution: 0 });
  });

  it("returns an empty set when every knob is blank (all track defaults)", () => {
    expect(parseAssumptionOverrides(field({}), 2026)).toEqual({});
  });

  it("propagates a field-level validation error", () => {
    expect(() => parseAssumptionOverrides(field({ birthYear: "3000" }), 2026)).toThrow(
      /between 1900 and 2026/i,
    );
  });
});
