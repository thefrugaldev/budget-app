// Reuses the "YYYY-MM" month helpers from the budget range module (no back-
// dependency, so no cycle — same cross-module-pure-helper pattern as
// lib/net-worth/series importing lib/budget/range).
import { currentMonthKey, shiftMonth } from "@/lib/budget/range";
import type { FireAssumptions, FireProjection } from "@/types/fire";

/**
 * The FIRE projection engine (#110 chunk 2) — pure math, no I/O. Everything is in
 * **today's dollars**: the nest egg compounds at the *real* rate (nominal −
 * inflation), contributions are constant, and the FIRE number never inflates
 * (ADR 0003 / CONTEXT). The composed {@link computeFireProjection} drives the
 * page; the smaller helpers are exported so each piece is independently testable.
 */

/** Derived real annual rate as a decimal: (nominal − inflation) percentages → e.g. (7, 3) → 0.04. */
export function realRate(nominalReturnPct: number, inflationPct: number): number {
  return (nominalReturnPct - inflationPct) / 100;
}

/**
 * The target nest egg (story 2): annual retirement spend ÷ safe withdrawal rate,
 * today's dollars. A non-positive SWR has no finite target — `Infinity` when
 * there's spend to cover, `0` when there isn't — rather than dividing by zero.
 */
export function fireNumber(monthlyRetirementSpend: number, safeWithdrawalRatePct: number): number {
  const swr = safeWithdrawalRatePct / 100;
  if (swr <= 0) return monthlyRetirementSpend > 0 ? Infinity : 0;
  return (monthlyRetirementSpend * 12) / swr;
}

/**
 * The coast number (story 5): the nest egg that, with **zero further
 * contributions**, compounds to the FIRE number by the traditional retirement
 * age — FIRE number ÷ (1 + real rate)^(years remaining). With no runway left
 * (already at/after that age) or a non-positive growth base, it equals the FIRE
 * number: compounding can't do any of the work.
 */
export function coastNumber(
  fire: number,
  annualRealRate: number,
  yearsToRetirement: number,
): number {
  if (!Number.isFinite(fire)) return fire;
  const base = 1 + annualRealRate;
  if (base <= 0 || yearsToRetirement <= 0) return fire;
  return fire / Math.pow(base, yearsToRetirement);
}

/** The monthly growth factor for an annual real rate, compounded geometrically. */
export function monthlyRate(annualRealRate: number): number {
  const base = 1 + annualRealRate;
  // A pathological base ≤ 0 (absurd inputs) can't take a fractional power; fall
  // back to a linear split so the series stays finite rather than NaN.
  return base > 0 ? Math.pow(base, 1 / 12) - 1 : annualRealRate / 12;
}

/**
 * Monthly nest-egg values from now (`[0]` = starting value) through `months`,
 * compounding at the real rate with a constant monthly contribution added at
 * each month's end. Length is `months + 1`. The chart (chunk 5) draws from this.
 */
export function projectSeries(
  startNestEgg: number,
  monthlyContribution: number,
  annualRealRate: number,
  months: number,
): number[] {
  const mr = monthlyRate(annualRealRate);
  const out = [startNestEgg];
  let value = startNestEgg;
  for (let t = 1; t <= months; t++) {
    value = value * (1 + mr) + monthlyContribution;
    out.push(value);
  }
  return out;
}

/**
 * Months from now until the compounding nest egg first reaches `target`:
 * `0` if it's already there, `null` if it never does within `capMonths` (a
 * declining or flat projection that can't catch a target, or an infinite target).
 */
export function monthsToReach(
  startNestEgg: number,
  monthlyContribution: number,
  annualRealRate: number,
  target: number,
  capMonths = 1200,
): number | null {
  if (!Number.isFinite(target)) return null;
  if (startNestEgg >= target) return 0;
  const mr = monthlyRate(annualRealRate);
  let value = startNestEgg;
  for (let t = 1; t <= capMonths; t++) {
    value = value * (1 + mr) + monthlyContribution;
    if (value >= target) return t;
  }
  return null;
}

/** Calendar-year age: the age the user turns during `year` (birth month unknown). */
export function ageInYear(birthYear: number, year: number): number {
  return year - birthYear;
}

/**
 * Compose the full projection for an assumption set + starting nest egg. `today`
 * is injectable so the date/age mapping is deterministic in tests. Reaching
 * either target is solved by month-stepping; an unreachable target yields a null
 * date/age rather than a fabricated one.
 */
export function computeFireProjection(
  assumptions: FireAssumptions,
  nestEgg: number,
  today = new Date(),
): FireProjection {
  const r = realRate(assumptions.nominalReturn, assumptions.inflation);
  const fire = fireNumber(assumptions.monthlyRetirementSpend, assumptions.safeWithdrawalRate);

  const nowYm = currentMonthKey(today);
  const currentYear = today.getUTCFullYear();
  const yearsToRetirement = Math.max(
    0,
    assumptions.birthYear + assumptions.traditionalRetirementAge - currentYear,
  );
  const coast = coastNumber(fire, r, yearsToRetirement);

  const monthsToFire = monthsToReach(nestEgg, assumptions.monthlyContribution, r, fire);
  const monthsToCoast = monthsToReach(nestEgg, assumptions.monthlyContribution, r, coast);
  const fireDate = monthsToFire === null ? null : shiftMonth(nowYm, monthsToFire);
  const coastDate = monthsToCoast === null ? null : shiftMonth(nowYm, monthsToCoast);
  const fireAge = fireDate === null ? null : ageInYear(assumptions.birthYear, Number(fireDate.slice(0, 4)));

  return {
    realRate: r,
    fireNumber: fire,
    coastNumber: coast,
    progress: fire > 0 && Number.isFinite(fire) ? nestEgg / fire : 0,
    coastProgress: coast > 0 && Number.isFinite(coast) ? nestEgg / coast : 0,
    monthsToFire,
    fireDate,
    fireAge,
    monthsToCoast,
    coastDate,
  };
}
