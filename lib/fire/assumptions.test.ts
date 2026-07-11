import { describe, expect, it } from "vitest";

import type { TrailingActuals } from "@/types/budget";

import { ASSUMPTION_CONSTANT_DEFAULTS, resolveAssumptions } from "./assumptions";

const actuals: TrailingActuals = { months: 12, monthlyExpense: 4200, monthlySavings: 1800 };

describe("resolveAssumptions", () => {
  it("falls back to data-derived + constant defaults with no overrides", () => {
    const r = resolveAssumptions(null, actuals);
    expect(r.monthlyRetirementSpend).toBe(4200); // trailing expense avg
    expect(r.monthlyContribution).toBe(1800); // trailing savings avg
    expect(r.nominalReturn).toBe(ASSUMPTION_CONSTANT_DEFAULTS.nominalReturn);
    expect(r.inflation).toBe(ASSUMPTION_CONSTANT_DEFAULTS.inflation);
    expect(r.safeWithdrawalRate).toBe(ASSUMPTION_CONSTANT_DEFAULTS.safeWithdrawalRate);
    expect(r.traditionalRetirementAge).toBe(
      ASSUMPTION_CONSTANT_DEFAULTS.traditionalRetirementAge,
    );
  });

  it("leaves birthYear null until explicitly overridden (no default)", () => {
    expect(resolveAssumptions(null, actuals).birthYear).toBeNull();
    expect(resolveAssumptions({}, actuals).birthYear).toBeNull();
    expect(resolveAssumptions({ birthYear: 1990 }, actuals).birthYear).toBe(1990);
  });

  it("lets a present override win over its default, per field", () => {
    const r = resolveAssumptions(
      { monthlyRetirementSpend: 5000, safeWithdrawalRate: 3.5 },
      actuals,
    );
    expect(r.monthlyRetirementSpend).toBe(5000); // overridden
    expect(r.monthlyContribution).toBe(1800); // untouched → tracks the data
    expect(r.safeWithdrawalRate).toBe(3.5); // overridden
    expect(r.nominalReturn).toBe(ASSUMPTION_CONSTANT_DEFAULTS.nominalReturn); // untouched
  });

  it("keeps a zero override distinct from an absent one (coast case, story 10)", () => {
    // 0 is a deliberate value, not "unset" — nullish-coalescing must preserve it.
    const r = resolveAssumptions({ monthlyContribution: 0 }, actuals);
    expect(r.monthlyContribution).toBe(0);
  });

  it("tracks the data as it changes when the knob is untouched", () => {
    const later: TrailingActuals = { months: 12, monthlyExpense: 4600, monthlySavings: 2100 };
    const r = resolveAssumptions(null, later);
    expect(r.monthlyRetirementSpend).toBe(4600);
    expect(r.monthlyContribution).toBe(2100);
  });

  it("resolves to all defaults from the empty (reset) override set", () => {
    const noHistory: TrailingActuals = { months: 0, monthlyExpense: 0, monthlySavings: 0 };
    const r = resolveAssumptions({}, noHistory);
    expect(r).toEqual({
      monthlyRetirementSpend: 0,
      monthlyContribution: 0,
      nominalReturn: 7,
      inflation: 3,
      safeWithdrawalRate: 4,
      traditionalRetirementAge: 65,
      birthYear: null,
    });
  });
});
