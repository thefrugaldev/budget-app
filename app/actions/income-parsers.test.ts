import { describe, expect, it } from "vitest";

import {
  parseCancelScheduledBaselineInput,
  parseIncomeFrequency,
  parsePayCadence,
  parsePerPaycheck,
  parseYearly,
} from "./income-parsers";

function makeFormData(entries: Record<string, string | null>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== null) fd.set(key, value);
  }
  return fd;
}

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

describe("parsePerPaycheck", () => {
  it("accepts a currency-formatted per-paycheck amount", () => {
    expect(parsePerPaycheck("$3,461.54")).toBe(3461.54);
  });

  it("rejects empty input with a per-paycheck-specific message", () => {
    expect(() => parsePerPaycheck("")).toThrow(/Amount per paycheck is required/);
  });

  it("rejects non-numeric and non-positive input", () => {
    expect(() => parsePerPaycheck("abc")).toThrow(/Amount per paycheck must be a number/);
    expect(() => parsePerPaycheck("0")).toThrow(
      /Amount per paycheck must be greater than zero/,
    );
  });
});

describe("parseIncomeFrequency", () => {
  it("accepts the two valid discriminators", () => {
    expect(parseIncomeFrequency("recurring")).toBe("recurring");
    expect(parseIncomeFrequency("one-time")).toBe("one-time");
  });

  it("rejects anything else", () => {
    expect(() => parseIncomeFrequency(null)).toThrow(/recurring or one-time/);
    expect(() => parseIncomeFrequency("weekly")).toThrow(/recurring or one-time/);
  });
});

describe("parsePayCadence", () => {
  it("accepts each of the four cadences", () => {
    for (const c of ["weekly", "bi-weekly", "semi-monthly", "monthly"] as const) {
      expect(parsePayCadence(c)).toBe(c);
    }
  });

  it("rejects a missing or unknown cadence", () => {
    expect(() => parsePayCadence(null)).toThrow(/pay cadence/i);
    expect(() => parsePayCadence("fortnightly")).toThrow(/pay cadence/i);
  });
});

describe("parseCancelScheduledBaselineInput", () => {
  it("returns the trimmed categoryId and parsed effectiveFrom for well-formed input", () => {
    const fd = makeFormData({
      categoryId: "  salary  ",
      effectiveFrom: "2026-09",
    });
    expect(parseCancelScheduledBaselineInput(fd)).toEqual({
      categoryId: "salary",
      effectiveFrom: "2026-09",
    });
  });

  it("rejects missing categoryId", () => {
    const fd = makeFormData({ effectiveFrom: "2026-09" });
    expect(() => parseCancelScheduledBaselineInput(fd)).toThrow(
      /categoryId is required/,
    );
  });

  it("rejects whitespace-only categoryId", () => {
    const fd = makeFormData({ categoryId: "   ", effectiveFrom: "2026-09" });
    expect(() => parseCancelScheduledBaselineInput(fd)).toThrow(
      /categoryId is required/,
    );
  });

  it("rejects missing effectiveFrom", () => {
    const fd = makeFormData({ categoryId: "salary" });
    expect(() => parseCancelScheduledBaselineInput(fd)).toThrow(
      /Effective from is required/,
    );
  });

  it("rejects malformed effectiveFrom", () => {
    const fd = makeFormData({ categoryId: "salary", effectiveFrom: "Sept 2026" });
    expect(() => parseCancelScheduledBaselineInput(fd)).toThrow(/YYYY-MM/);
  });
});
