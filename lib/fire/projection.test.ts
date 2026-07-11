import { describe, expect, it } from "vitest";

import type { FireAssumptions } from "@/types/fire";

import {
  ageInYear,
  coastNumber,
  computeFireProjection,
  fireNumber,
  monthlyRate,
  monthsToReach,
  projectSeries,
  realRate,
} from "./projection";

describe("realRate", () => {
  it("is nominal minus inflation, as a decimal", () => {
    expect(realRate(7, 3)).toBeCloseTo(0.04, 10);
    expect(realRate(3, 3)).toBeCloseTo(0, 10);
    expect(realRate(2, 5)).toBeCloseTo(-0.03, 10); // real losses when inflation outruns returns
  });
});

describe("fireNumber", () => {
  it("is annual retirement spend divided by the safe withdrawal rate", () => {
    expect(Math.round(fireNumber(4000, 4))).toBe(1_200_000); // 48k / 0.04
    expect(fireNumber(0, 4)).toBe(0);
  });

  it("has no finite target when the withdrawal rate is non-positive", () => {
    expect(fireNumber(4000, 0)).toBe(Infinity);
    expect(fireNumber(0, 0)).toBe(0);
  });
});

describe("coastNumber", () => {
  it("discounts the FIRE number back over the years of remaining compounding", () => {
    expect(coastNumber(1_200_000, 0.04, 29)).toBeCloseTo(1_200_000 / 1.04 ** 29, 2);
  });

  it("equals the FIRE number when there is no runway left", () => {
    expect(coastNumber(1_200_000, 0.04, 0)).toBe(1_200_000);
  });

  it("exceeds the FIRE number when real growth is negative (compounding shrinks it)", () => {
    expect(coastNumber(1_200_000, -0.02, 10)).toBeGreaterThan(1_200_000);
  });
});

describe("monthlyRate", () => {
  it("compounds to the annual real rate over twelve months", () => {
    const mr = monthlyRate(0.04);
    expect((1 + mr) ** 12).toBeCloseTo(1.04, 10);
  });

  it("is zero for a zero real rate", () => {
    expect(monthlyRate(0)).toBe(0);
  });
});

describe("projectSeries", () => {
  it("starts at the current nest egg and has length months + 1", () => {
    const s = projectSeries(100_000, 1000, 0.04, 12);
    expect(s).toHaveLength(13);
    expect(s[0]).toBe(100_000);
  });

  it("adds the contribution linearly when the real rate is zero", () => {
    expect(projectSeries(100_000, 1000, 0, 3)).toEqual([100_000, 101_000, 102_000, 103_000]);
  });

  it("grows a no-contribution balance by the annual real rate over a year", () => {
    const s = projectSeries(100_000, 0, 0.04, 12);
    expect(s[12]).toBeCloseTo(104_000, 2);
  });
});

describe("monthsToReach", () => {
  it("is zero when the nest egg already meets the target", () => {
    expect(monthsToReach(1_300_000, 2000, 0.04, 1_200_000)).toBe(0);
  });

  it("returns a finite month count when contributions + growth get there", () => {
    const m = monthsToReach(100_000, 2000, 0.04, 1_200_000);
    expect(m).not.toBeNull();
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(1200);
  });

  it("reaches a target on compounding alone (zero contributions, coast case)", () => {
    const m = monthsToReach(100_000, 0, 0.04, 200_000);
    expect(m).not.toBeNull();
    expect(m).toBeGreaterThan(0);
  });

  it("never reaches when flat and under target (zero contributions, zero rate)", () => {
    expect(monthsToReach(100_000, 0, 0, 200_000)).toBeNull();
  });

  it("never reaches an infinite target", () => {
    expect(monthsToReach(100_000, 2000, 0.04, Infinity)).toBeNull();
  });
});

describe("ageInYear", () => {
  it("maps a birth year and a calendar year to an age", () => {
    expect(ageInYear(1990, 2037)).toBe(47);
  });
});

describe("computeFireProjection", () => {
  const base: FireAssumptions = {
    monthlyRetirementSpend: 4000,
    monthlyContribution: 2000,
    nominalReturn: 7,
    inflation: 3,
    safeWithdrawalRate: 4,
    birthYear: 1990,
    traditionalRetirementAge: 65,
  };
  const today = new Date(Date.UTC(2026, 6, 15)); // 2026-07

  it("derives the headline figures and solves reachable dates", () => {
    const p = computeFireProjection(base, 100_000, today);
    expect(p.realRate).toBeCloseTo(0.04, 10);
    expect(Math.round(p.fireNumber)).toBe(1_200_000);
    // Retirement year 2055; 29 years of runway from 2026.
    expect(p.coastNumber).toBeCloseTo(1_200_000 / 1.04 ** 29, 2);
    expect(p.progress).toBeCloseTo(100_000 / 1_200_000, 10);
    expect(p.coastProgress).toBeCloseTo(100_000 / p.coastNumber, 10);

    expect(p.monthsToFire).not.toBeNull();
    expect(p.monthsToCoast).not.toBeNull();
    // Coast is a lower target than FIRE, so it's reached no later.
    expect(p.monthsToCoast!).toBeLessThan(p.monthsToFire!);
    // Date + age are self-consistent (age = FIRE-date year − birth year).
    expect(p.fireDate).toMatch(/^\d{4}-\d{2}$/);
    expect(p.fireAge).toBe(Number(p.fireDate!.slice(0, 4)) - 1990);
  });

  it("reports today with the current age when already past the FIRE number", () => {
    const p = computeFireProjection(base, 1_500_000, today);
    expect(p.monthsToFire).toBe(0);
    expect(p.fireDate).toBe("2026-07");
    expect(p.fireAge).toBe(36); // 2026 − 1990
    expect(p.progress).toBeCloseTo(1.25, 10);
  });

  it("yields null date/age when the target is never reached", () => {
    // Zero contributions and zero real rate: the balance never moves.
    const stalled: FireAssumptions = { ...base, monthlyContribution: 0, nominalReturn: 3 };
    const p = computeFireProjection(stalled, 100_000, today);
    expect(p.monthsToFire).toBeNull();
    expect(p.fireDate).toBeNull();
    expect(p.fireAge).toBeNull();
  });
});
