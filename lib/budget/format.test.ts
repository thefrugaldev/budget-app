import { describe, expect, it } from "vitest";

import { fmt } from "./format";

describe("fmt", () => {
  it("shows whole dollars once the magnitude clears $100", () => {
    expect(fmt(549_341)).toBe("$549,341");
    expect(fmt(520_000)).toBe("$520,000");
  });

  it("shows cents below $100", () => {
    expect(fmt(4.5)).toBe("$4.50");
    expect(fmt(99.99)).toBe("$99.99");
  });

  it("rounds negatives by magnitude, not sign (the liability cents fix, #195)", () => {
    // Before the Math.abs, every negative fell under `< 100` and rendered cents.
    expect(fmt(-315_000)).toBe("-$315,000");
    expect(fmt(-300_000)).toBe("-$300,000");
    // A small negative still keeps cents — a $12.50 refund reads honestly.
    expect(fmt(-12.5)).toBe("-$12.50");
  });
});
