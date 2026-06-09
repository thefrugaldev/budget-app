import { describe, expect, it } from "vitest";

import {
  parseCategoryKind,
  parseMonthKey,
  parseMonthlyTarget,
  parseOptionalMonthKey,
} from "./category-parsers";

describe("parseMonthlyTarget", () => {
  it("accepts a bare numeric string", () => {
    expect(parseMonthlyTarget("800")).toBe(800);
  });

  it("accepts currency-formatted strings", () => {
    expect(parseMonthlyTarget("$1,234.56")).toBe(1234.56);
  });

  it("accepts zero (track-without-cap)", () => {
    // A $0 target is meaningful — it's a "category that exists for tracking
    // but has no spend cap." The parser must allow it; the rest of the app
    // (threshold meter) already renders zero-target categories sensibly.
    expect(parseMonthlyTarget("0")).toBe(0);
  });

  it("rejects empty input", () => {
    expect(() => parseMonthlyTarget("")).toThrow(/required/i);
    expect(() => parseMonthlyTarget(null)).toThrow(/required/i);
  });

  it("rejects non-numeric input", () => {
    expect(() => parseMonthlyTarget("abc")).toThrow(/number/i);
  });

  it("rejects negative values", () => {
    expect(() => parseMonthlyTarget("-50")).toThrow(/negative/i);
  });
});

describe("parseCategoryKind", () => {
  it.each(["expense", "savings", "income"] as const)("accepts %s", (kind) => {
    expect(parseCategoryKind(kind)).toBe(kind);
  });

  it("rejects empty input", () => {
    expect(() => parseCategoryKind("")).toThrow(/required/i);
    expect(() => parseCategoryKind(null)).toThrow(/required/i);
  });

  it("rejects unknown values", () => {
    expect(() => parseCategoryKind("liability")).toThrow(/expense, savings, or income/);
  });
});

describe("parseMonthKey", () => {
  it("accepts well-formed YYYY-MM", () => {
    expect(parseMonthKey("2026-06", "Effective from")).toBe("2026-06");
  });

  it("rejects missing input with the field name", () => {
    expect(() => parseMonthKey("", "Effective from")).toThrow(
      /Effective from is required/,
    );
  });

  it("rejects malformed strings", () => {
    expect(() => parseMonthKey("2026-6", "Effective from")).toThrow(/YYYY-MM/);
    expect(() => parseMonthKey("2026-13", "Effective from")).toThrow(/YYYY-MM/);
    expect(() => parseMonthKey("2026-06-01", "Effective from")).toThrow(/YYYY-MM/);
  });
});

describe("parseOptionalMonthKey", () => {
  it("returns undefined for missing / empty input", () => {
    expect(parseOptionalMonthKey(null, "Active from")).toBeUndefined();
    expect(parseOptionalMonthKey("", "Active from")).toBeUndefined();
    expect(parseOptionalMonthKey("   ", "Active from")).toBeUndefined();
  });

  it("returns a parsed value when present", () => {
    expect(parseOptionalMonthKey("2026-06", "Active from")).toBe("2026-06");
  });

  it("still rejects a malformed non-empty value", () => {
    expect(() => parseOptionalMonthKey("June 2026", "Active from")).toThrow(/YYYY-MM/);
  });
});
