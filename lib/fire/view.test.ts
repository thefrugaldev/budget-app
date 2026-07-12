import { describe, expect, it } from "vitest";

import type { ResolvedAssumptions } from "@/types/fire";

import { deriveFireView } from "./view";

const base: ResolvedAssumptions = {
  monthlyRetirementSpend: 4000,
  monthlyContribution: 2000,
  nominalReturn: 7,
  inflation: 3,
  safeWithdrawalRate: 4,
  traditionalRetirementAge: 65,
  birthYear: 1990,
};
const today = new Date(Date.UTC(2026, 6, 15)); // 2026-07

describe("deriveFireView", () => {
  it("derives the always-available KPIs (no birth year needed)", () => {
    const v = deriveFireView({ ...base, birthYear: null }, 300_000, today);
    expect(v.realRate).toBeCloseTo(0.04, 10);
    expect(Math.round(v.fireNumber)).toBe(1_200_000); // 48k / 0.04
    expect(v.progress).toBeCloseTo(300_000 / 1_200_000, 10);
  });

  it("withholds the projection until the birth year is set", () => {
    expect(deriveFireView({ ...base, birthYear: null }, 300_000, today).projection).toBeNull();
    const set = deriveFireView(base, 300_000, today);
    expect(set.projection).not.toBeNull();
    // The projection agrees with the standalone KPIs.
    expect(set.projection!.fireNumber).toBe(set.fireNumber);
    expect(set.projection!.progress).toBeCloseTo(set.progress, 10);
    expect(set.projection!.fireAge).toBe(
      Number(set.projection!.fireDate!.slice(0, 4)) - 1990,
    );
  });

  it("reports zero progress and no crash for a non-positive withdrawal rate", () => {
    // A live SWR of 0 has no finite FIRE number (Infinity) — progress must be 0,
    // not NaN, so the KPI renders a dash rather than garbage.
    const v = deriveFireView({ ...base, safeWithdrawalRate: 0 }, 300_000, today);
    expect(v.fireNumber).toBe(Infinity);
    expect(v.progress).toBe(0);
  });

  it("carries a zero nest egg through to zero progress", () => {
    expect(deriveFireView(base, 0, today).progress).toBe(0);
  });
});
