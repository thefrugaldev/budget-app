import { describe, expect, it } from "vitest";

import { proposeTargetFromMedian } from "./target-suggestion";

describe("proposeTargetFromMedian — friendly round-up", () => {
  it("rounds up to the nearest $5 under $100", () => {
    expect(proposeTargetFromMedian(86)).toBe(90);
    expect(proposeTargetFromMedian(91)).toBe(95);
    expect(proposeTargetFromMedian(1)).toBe(5);
  });

  it("rounds up to the nearest $10 from $100 up to (not incl.) $250", () => {
    expect(proposeTargetFromMedian(145)).toBe(150);
    expect(proposeTargetFromMedian(151)).toBe(160);
    expect(proposeTargetFromMedian(100)).toBe(100);
  });

  it("rounds up to the nearest $25 from $250 up to (not incl.) $1,000", () => {
    expect(proposeTargetFromMedian(612)).toBe(625);
    expect(proposeTargetFromMedian(626)).toBe(650);
    expect(proposeTargetFromMedian(251)).toBe(275);
  });

  it("rounds up to the nearest $50 at $1,000 and above", () => {
    expect(proposeTargetFromMedian(1010)).toBe(1050);
    expect(proposeTargetFromMedian(2333)).toBe(2350);
    expect(proposeTargetFromMedian(3001)).toBe(3050);
  });

  it("keeps the top $50 band open-ended at large magnitudes", () => {
    expect(proposeTargetFromMedian(100000)).toBe(100000);
    expect(proposeTargetFromMedian(100013)).toBe(100050);
  });

  it("does not let the epsilon collapse a value sitting just above an increment", () => {
    // 90.5 is above the $90 increment and must round up to $95, not be pulled
    // back to $90 — the epsilon only absorbs float error at the increment.
    expect(proposeTargetFromMedian(90.5)).toBe(95);
    expect(proposeTargetFromMedian(150.01)).toBe(160);
  });

  it("chooses the band from the input figure, then rounds up across boundaries", () => {
    // 98 is in the sub-$100 ($5) band and rounds up onto the $100 boundary.
    expect(proposeTargetFromMedian(98)).toBe(100);
    // 249 is in the sub-$250 ($10) band and rounds up onto $250.
    expect(proposeTargetFromMedian(249)).toBe(250);
    // 990 is in the sub-$1,000 ($25) band and rounds up onto $1,000.
    expect(proposeTargetFromMedian(990)).toBe(1000);
  });

  it("returns a figure already on its increment unchanged", () => {
    expect(proposeTargetFromMedian(85)).toBe(85);
    expect(proposeTargetFromMedian(150)).toBe(150);
    expect(proposeTargetFromMedian(625)).toBe(625);
    expect(proposeTargetFromMedian(250)).toBe(250);
    expect(proposeTargetFromMedian(1000)).toBe(1000);
  });

  it("rounds fractional cents up to the friendly increment", () => {
    expect(proposeTargetFromMedian(87.3)).toBe(90);
    expect(proposeTargetFromMedian(612.5)).toBe(625);
    expect(proposeTargetFromMedian(1000.01)).toBe(1050);
  });

  it("yields 0 for a non-positive median (no sensible friendly cap)", () => {
    expect(proposeTargetFromMedian(0)).toBe(0);
    expect(proposeTargetFromMedian(-40)).toBe(0);
  });
});
