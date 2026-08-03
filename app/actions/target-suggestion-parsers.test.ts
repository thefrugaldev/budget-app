import { describe, expect, it } from "vitest";

import { parseCategoryId, parseSuggestionAmount } from "./target-suggestion-parsers";

describe("parseCategoryId", () => {
  it("trims a valid id", () => {
    expect(parseCategoryId("  daycare  ")).toBe("daycare");
  });

  it("rejects blank / non-string input", () => {
    expect(() => parseCategoryId("")).toThrow(/required/i);
    expect(() => parseCategoryId("   ")).toThrow(/required/i);
    expect(() => parseCategoryId(null)).toThrow(/required/i);
  });
});

describe("parseSuggestionAmount", () => {
  it("parses a whole-dollar numeric string", () => {
    expect(parseSuggestionAmount("450", "proposedTarget")).toBe(450);
  });

  it("parses a fractional amount (median can carry cents)", () => {
    expect(parseSuggestionAmount("1300.5", "dismissedMedian")).toBe(1300.5);
  });

  it("permits zero", () => {
    expect(parseSuggestionAmount("0", "dismissedMedian")).toBe(0);
  });

  it("trims surrounding whitespace", () => {
    expect(parseSuggestionAmount("  25 ", "proposedTarget")).toBe(25);
  });

  it("rejects blank / non-string input, naming the field", () => {
    expect(() => parseSuggestionAmount("", "proposedTarget")).toThrow(
      /proposedTarget is required/,
    );
    expect(() => parseSuggestionAmount(null, "proposedTarget")).toThrow(
      /proposedTarget is required/,
    );
  });

  it("rejects non-numeric text", () => {
    expect(() => parseSuggestionAmount("abc", "dismissedMedian")).toThrow(
      /dismissedMedian must be a number/,
    );
  });

  it("rejects a negative amount (a garbled post)", () => {
    expect(() => parseSuggestionAmount("-25", "dismissedAgainstTarget")).toThrow(
      /dismissedAgainstTarget cannot be negative/,
    );
  });
});
