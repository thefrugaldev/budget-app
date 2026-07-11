import { describe, expect, it } from "vitest";

import { bandScale, domainMax, extentScale, linearScale, niceScale, spreadX } from "./scale";

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

describe("spreadX", () => {
  it("places points edge-to-edge across the extent", () => {
    const x = spreadX(5, 400);
    expect(x.at(0)).toBe(0);
    expect(x.at(4)).toBe(400);
    expect(x.at(2)).toBe(200);
  });

  it("offsets by the start position", () => {
    const x = spreadX(3, 100, 20);
    expect(x.at(0)).toBe(20);
    expect(x.at(2)).toBe(120);
  });

  it("puts a single point at the start (no span to divide)", () => {
    expect(spreadX(1, 400, 10).at(0)).toBe(10);
  });
});

describe("extentScale", () => {
  it("maps max to the top and min to the bottom", () => {
    const s = extentScale(0, 100, 200);
    expect(s.y(100)).toBe(0);
    expect(s.y(0)).toBe(200);
    expect(s.y(50)).toBe(100);
  });

  it("supports a signed domain, exposing the zero line via y(0)", () => {
    // Domain [-100, 100] over 200px: 0 sits in the middle, negatives below it.
    const s = extentScale(-100, 100, 200);
    expect(s.y(0)).toBe(100);
    expect(s.y(-100)).toBe(200);
    expect(s.y(100)).toBe(0);
  });

  it("centers everything when the domain is degenerate (min === max)", () => {
    const s = extentScale(50, 50, 200);
    expect(s.y(50)).toBe(100);
    expect(Number.isFinite(s.y(0))).toBe(true);
  });
});

describe("niceScale", () => {
  it("rounds the domain out to nice bounds that contain the data", () => {
    const s = niceScale(97000, 210327, 4);
    expect(s.niceMin).toBeLessThanOrEqual(97000);
    expect(s.niceMax).toBeGreaterThanOrEqual(210327);
    // Bounds and step land on round numbers, not raw data values.
    expect(s.niceMin % s.step).toBe(0);
    expect(s.niceMax % s.step).toBe(0);
  });

  it("returns ascending ticks spanning the nice bounds", () => {
    const { ticks, niceMin, niceMax } = niceScale(0, 100, 5);
    expect(ticks[0]).toBe(niceMin);
    expect(ticks[ticks.length - 1]).toBe(niceMax);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });

  it("uses a fit-to-data domain that need not start at zero", () => {
    // A tight band of large values: the min floors to a round number well above
    // zero, so the plot fills with the data's range instead of hugging zero.
    const { niceMin } = niceScale(180000, 210000, 4);
    expect(niceMin).toBeGreaterThan(0);
  });

  it("widens a flat domain instead of dividing by zero", () => {
    const { ticks, niceMin, niceMax, step } = niceScale(500, 500, 4);
    expect(step).toBeGreaterThan(0);
    expect(niceMax).toBeGreaterThan(niceMin);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks.every((t) => Number.isFinite(t))).toBe(true);
  });

  it("handles a zero-only domain without NaN", () => {
    const { ticks, step } = niceScale(0, 0, 4);
    expect(step).toBeGreaterThan(0);
    expect(ticks.every((t) => Number.isFinite(t))).toBe(true);
  });
});
