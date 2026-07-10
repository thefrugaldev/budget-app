import { describe, expect, it } from "vitest";

import { areaPath, linePath } from "./path";

describe("linePath", () => {
  it("moves to the first point then lines to the rest", () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 5, y: 20 }, { x: 10, y: 0 }])).toBe(
      "M 0 10 L 5 20 L 10 0",
    );
  });

  it("rounds coordinates to two decimals", () => {
    expect(linePath([{ x: 1.23456, y: 9.87654 }])).toBe("M 1.23 9.88");
  });

  it("is empty for no points", () => {
    expect(linePath([])).toBe("");
  });
});

describe("areaPath", () => {
  it("draws the line then closes down to the baseline and back", () => {
    expect(areaPath([{ x: 0, y: 10 }, { x: 10, y: 4 }], 30)).toBe(
      "M 0 10 L 10 4 L 10 30 L 0 30 Z",
    );
  });

  it("closes to an arbitrary baseline (e.g. the zero line, not the bottom)", () => {
    // A single-point area still closes into a (degenerate) filled shape.
    expect(areaPath([{ x: 5, y: 8 }], 20)).toBe("M 5 8 L 5 20 L 5 20 Z");
  });

  it("is empty for no points", () => {
    expect(areaPath([], 30)).toBe("");
  });
});
