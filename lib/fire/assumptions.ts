import type { TrailingActuals } from "@/types/budget";
import type { FireAssumptionOverrides, ResolvedAssumptions } from "@/types/fire";

/**
 * FIRE assumptions resolution (#110 chunk 3) — the single source of the knob
 * defaults and the pure merge that layers a user's stored overrides over them.
 * No I/O: the server fetches the overrides (repository) and the trailing budget
 * actuals (chunk 1), and this composes the live assumption set the page shows.
 */

/**
 * The constant defaults for the knobs that don't derive from budget data (ADR
 * 0003 / CONTEXT "Assumption"). Spend and contribution default from
 * {@link TrailingActuals}; `birthYear` has no default at all (see
 * {@link ResolvedAssumptions}). Rates are percentages, matching the stored shape.
 */
export const ASSUMPTION_CONSTANT_DEFAULTS = {
  /** Expected nominal annual return, percent. */
  nominalReturn: 7,
  /** Expected annual inflation, percent. */
  inflation: 3,
  /** Safe withdrawal rate, percent. */
  safeWithdrawalRate: 4,
  /** Age at which coast compounding must finish the job. */
  traditionalRetirementAge: 65,
} as const;

/**
 * Merge stored overrides over the data-derived + constant defaults, yielding the
 * live assumption set (story 15/16). An absent override tracks its default, so an
 * untouched knob follows the budget data as it changes; a present override wins.
 * `birthYear` resolves to `null` when unset — it has no default, so only an
 * explicit override makes it a number (the page prompts for it and withholds
 * age/coast figures until then). Passing `null`/`{}` overrides returns the pure
 * defaults, which is exactly what reset-to-defaults surfaces.
 */
export function resolveAssumptions(
  overrides: FireAssumptionOverrides | null,
  actuals: TrailingActuals,
): ResolvedAssumptions {
  const o = overrides ?? {};
  return {
    monthlyRetirementSpend: o.monthlyRetirementSpend ?? actuals.monthlyExpense,
    monthlyContribution: o.monthlyContribution ?? actuals.monthlySavings,
    nominalReturn: o.nominalReturn ?? ASSUMPTION_CONSTANT_DEFAULTS.nominalReturn,
    inflation: o.inflation ?? ASSUMPTION_CONSTANT_DEFAULTS.inflation,
    safeWithdrawalRate: o.safeWithdrawalRate ?? ASSUMPTION_CONSTANT_DEFAULTS.safeWithdrawalRate,
    traditionalRetirementAge:
      o.traditionalRetirementAge ?? ASSUMPTION_CONSTANT_DEFAULTS.traditionalRetirementAge,
    birthYear: o.birthYear ?? null,
  };
}
