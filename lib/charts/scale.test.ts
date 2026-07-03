import { describe, expect, it } from "vitest";

import { bandScale, domainMax, linearScale } from "./scale";

describe("domainMax", () => {
  it("returns the largest value with no headroom", () => {
    expect(domainMax([3, 7, 2])).toBe(7);
  });

  it("floors at 1 for an empty dataset", () => {
    expect(domainMax([])).toBe(1);
  });

  it("floors at 1 when every value is below the floor", () => {
    expect(domainMax([0, 0])).toBe(1);
    expect(domainMax([0.3])).toBe(1);
  });

  it("lifts the ceiling by the headroom fraction", () => {
    expect(domainMax([100], { headroom: 0.15 })).toBeCloseTo(115, 10);
  });

  it("honors a custom floor", () => {
    expect(domainMax([], { floor: 10 })).toBe(10);
    expect(domainMax([4], { floor: 10 })).toBe(10);
  });
});

describe("linearScale", () => {
  it("maps a value proportionally into the extent", () => {
    expect(linearScale(100, 200).length(50)).toBe(100);
  });

  it("maps the domain max to the full extent", () => {
    expect(linearScale(100, 200).length(100)).toBe(200);
  });

  it("clamps negative values to zero (bars never invert)", () => {
    expect(linearScale(100, 200).length(-5)).toBe(0);
  });

  it("stays finite when the domain floors at zero (no NaN/Infinity)", () => {
    // The degenerate case the render-time domain floor guards against: a
    // near-zero dataset with no plan. safeMax → 1, so lengths stay finite.
    const scale = linearScale(0, 200);
    expect(scale.length(0)).toBe(0);
    expect(Number.isFinite(scale.length(0.3))).toBe(true);
  });
});

describe("bandScale", () => {
  it("divides the extent into equal slots", () => {
    expect(bandScale(4, 400).slot).toBe(100);
  });

  it("centers content within each slot", () => {
    const band = bandScale(4, 400);
    expect(band.center(0)).toBe(50);
    expect(band.center(3)).toBe(350);
  });

  it("offsets centers by the start position", () => {
    // slot = 100/2 = 50; center(0) = start 20 + slot/2 25 = 45.
    expect(bandScale(2, 100, 20).center(0)).toBe(45);
    expect(bandScale(2, 100, 20).center(1)).toBe(95);
  });

  it("guards against a zero count (no divide-by-zero)", () => {
    const band = bandScale(0, 400);
    expect(band.slot).toBe(400);
    expect(Number.isFinite(band.center(0))).toBe(true);
  });
});
