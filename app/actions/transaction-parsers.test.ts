import { describe, expect, it } from "vitest";

import {
  applySign,
  parseIsoDate,
  parsePositiveAmount,
} from "./transaction-parsers";

describe("parsePositiveAmount", () => {
  it("accepts a bare numeric string", () => {
    expect(parsePositiveAmount("87.42")).toBe(87.42);
  });

  it("accepts currency-formatted strings", () => {
    expect(parsePositiveAmount("$1,234.56")).toBe(1234.56);
  });

  it("rejects empty input", () => {
    expect(() => parsePositiveAmount("")).toThrow(/required/i);
    expect(() => parsePositiveAmount(null)).toThrow(/required/i);
  });

  it("rejects non-numeric input", () => {
    expect(() => parsePositiveAmount("abc")).toThrow(/number/i);
  });

  it("rejects zero and negative values", () => {
    expect(() => parsePositiveAmount("0")).toThrow(/greater than zero/i);
    expect(() => parsePositiveAmount("-50")).toThrow(/greater than zero/i);
  });
});

describe("applySign", () => {
  it("returns the amount unchanged when sign is '+'", () => {
    expect(applySign(50, "+")).toBe(50);
  });

  it("negates the amount when sign is '-'", () => {
    expect(applySign(50, "-")).toBe(-50);
  });

  it("falls back to positive when sign is missing or unknown", () => {
    // A stale or hostile client may omit `sign`; positive is the safer
    // default since it surfaces to the user instead of silently negating.
    expect(applySign(50, null)).toBe(50);
    expect(applySign(50, "whatever")).toBe(50);
  });
});

describe("parseIsoDate", () => {
  it("accepts a well-formed YYYY-MM-DD string", () => {
    expect(parseIsoDate("2026-06-08")).toBe("2026-06-08");
  });

  it("rejects empty / missing input", () => {
    expect(() => parseIsoDate("")).toThrow(/date is required/i);
    expect(() => parseIsoDate(null)).toThrow(/date is required/i);
  });

  it("rejects malformed dates", () => {
    expect(() => parseIsoDate("06/08/2026")).toThrow(/date is required/i);
    expect(() => parseIsoDate("2026-6-8")).toThrow(/date is required/i);
  });
});
