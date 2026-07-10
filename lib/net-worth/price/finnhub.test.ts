import { describe, expect, it } from "vitest";

import { parseFinnhubQuote } from "./finnhub";

describe("parseFinnhubQuote", () => {
  it("reads the current price `c` from a real quote response", () => {
    // Shape of a Finnhub /quote body (fixture, invented numbers).
    const body = { c: 261.74, d: 1.2, dp: 0.46, h: 262.0, l: 259.1, o: 260.0, pc: 260.54, t: 1_720_000_000 };
    expect(parseFinnhubQuote(body)).toBe(261.74);
  });

  it("treats an unknown symbol (all-zero body) as no quote", () => {
    // Finnhub returns c:0 for a symbol it doesn't recognise.
    expect(parseFinnhubQuote({ c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 })).toBeUndefined();
  });

  it("rejects negative or non-numeric prices and malformed bodies", () => {
    expect(parseFinnhubQuote({ c: -5 })).toBeUndefined();
    expect(parseFinnhubQuote({ c: "261.74" })).toBeUndefined();
    expect(parseFinnhubQuote({})).toBeUndefined();
    expect(parseFinnhubQuote(null)).toBeUndefined();
    expect(parseFinnhubQuote("nope")).toBeUndefined();
  });
});
