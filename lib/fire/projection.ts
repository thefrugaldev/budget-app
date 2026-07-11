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

/**
 * Derived real annual rate as a decimal: (nominal − inflation) percentages →
 * e.g. (7, 3) → 0.04. This is the **linear approximation** ADR 0003 chose, not
 * the geometric Fisher rate `(1 + n) / (1 + i) − 1` (which gives 3.88% here) —
 * the ~0.12pp difference is immaterial for a planning tool, and subtraction is
 * the documented model. Not a bug; don't "fix" it to Fisher without revisiting
 * the ADR.
 */
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
 * Months from now until the compounding nest egg first reaches each `target`,
 * in a **single** walk (index-aligned to `targets`): `0` if already there,
 * `null` if never within `capMonths` (a flat/declining projection that can't
 * catch it, or an infinite target). One pass keeps the FIRE + coast solve to a
 * single loop on the live-recompute path rather than one loop per target.
 */
export function monthsToReachEach(
  startNestEgg: number,
  monthlyContribution: number,
  annualRealRate: number,
  targets: number[],
  capMonths = 1200,
): (number | null)[] {
  const result: (number | null)[] = targets.map((t) =>
    Number.isFinite(t) && startNestEgg >= t ? 0 : null,
  );
  const unsolved = () => result.some((r, i) => r === null && Number.isFinite(targets[i]));
  if (!unsolved()) return result;

  const mr = monthlyRate(annualRealRate);
  let value = startNestEgg;
  for (let t = 1; t <= capMonths; t++) {
    value = value * (1 + mr) + monthlyContribution;
    for (let i = 0; i < targets.length; i++) {
      if (result[i] === null && Number.isFinite(targets[i]) && value >= targets[i]) result[i] = t;
    }
    if (!unsolved()) break; // all finite targets crossed — stop early
  }
  return result;
}

/**
 * Months from now until the nest egg first reaches a single `target` — a thin
 * wrapper over {@link monthsToReachEach}. `0` if already there, `null` if never.
 */
export function monthsToReach(
  startNestEgg: number,
  monthlyContribution: number,
  annualRealRate: number,
  target: number,
  capMonths = 1200,
): number | null {
  return monthsToReachEach(startNestEgg, monthlyContribution, annualRealRate, [target], capMonths)[0];
}

/** Calendar-year age: the age the user turns during `year` (birth month unknown). */
export function ageInYear(birthYear: number, year: number): number {
  return year - birthYear;
}

/**
 * Compose the full projection for an assumption set + starting nest egg. `today`
 * is injectable so the date/age mapping is deterministic in tests. Both targets
 * are solved in one walk; an unreachable target yields a null date/age rather
 * than a fabricated one.
 *
 * `yearsToRetirement` is a calendar-year integer (retirement year − current
 * year), ignoring birth month — the same approximation as {@link ageInYear},
 * since the assumption set has no birth month. A late-year user is credited up
 * to ~11 fewer months of coast runway than an early-year one; immaterial for a
 * planning tool, but a documented approximation rather than an oversight.
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

  // One walk for both thresholds (coast is usually reached first, but not when a
  // negative real rate pushes the coast target above the FIRE number).
  const [monthsToCoast, monthsToFire] = monthsToReachEach(
    nestEgg,
    assumptions.monthlyContribution,
    r,
    [coast, fire],
  );
  const fireDate = monthsToFire === null ? null : shiftMonth(nowYm, monthsToFire);
  const coastDate = monthsToCoast === null ? null : shiftMonth(nowYm, monthsToCoast);
  const ageAtDate = (ym: string | null) =>
    ym === null ? null : ageInYear(assumptions.birthYear, Number(ym.slice(0, 4)));

  return {
    realRate: r,
    fireNumber: fire,
    coastNumber: coast,
    progress: fire > 0 && Number.isFinite(fire) ? nestEgg / fire : 0,
    coastProgress: coast > 0 && Number.isFinite(coast) ? nestEgg / coast : 0,
    monthsToFire,
    fireDate,
    fireAge: ageAtDate(fireDate),
    monthsToCoast,
    coastDate,
    coastAge: ageAtDate(coastDate),
  };
}
