import { currentMonthKey, shiftMonth } from "@/lib/budget/range";
import type { NetWorthPoint } from "@/types/net-worth";
import type { ProjectionChartData, ProjectionChartPoint, ResolvedAssumptions } from "@/types/fire";

import {
  coastNumber,
  fireNumber,
  monthsToReachEach,
  projectSeries,
  realRate,
} from "./projection";

/**
 * Build the FIRE projection chart's data (#110 chunk 5) — pure, no I/O — by
 * stitching recorded nest-egg history onto the projected curve and solving the
 * FIRE / coast crossings, so the client recomputes it per keystroke (story 14)
 * and it unit-tests without a component. Everything is in today's dollars (the
 * engine's terms); `today` is injectable for deterministic tests and is passed a
 * server-stable value on the page to avoid an SSR/client drift.
 *
 * The recorded segment is history strictly *before* this month — the projection
 * owns "now" onward, starting from the live-priced `nestEgg`, so a stale last
 * snapshot never shadows the current figure. The two segments meet at that
 * junction and render as one trajectory (solid → dashed).
 *
 * `fireNumber` is `null` when it isn't a finite positive value to draw (a
 * zero/absent spend or a non-positive withdrawal rate); `coastNumber` is `null`
 * until a birth year is set (it needs the retirement horizon). Crossings are
 * reported only when they fall within the drawn horizon, so every returned
 * crossing "YYYY-MM" is guaranteed to be one of `points`.
 */

// Draw a 10-year floor (so a near-term FIRE still shows runway past the crossing)
// up to a 60-year ceiling (beyond which a "plan" is meaningless). The horizon
// extends to the furthest milestone with a 15% margin, then clamps to this band.
const HORIZON_MIN_MONTHS = 120;
const HORIZON_MAX_MONTHS = 720;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function buildProjectionChart(
  resolved: ResolvedAssumptions,
  nestEgg: number,
  history: NetWorthPoint[],
  today = new Date(),
): ProjectionChartData {
  const r = realRate(resolved.nominalReturn, resolved.inflation);
  const fire = fireNumber(resolved.monthlyRetirementSpend, resolved.safeWithdrawalRate);
  const fireDrawable = Number.isFinite(fire) && fire > 0 ? fire : null;

  const nowYm = currentMonthKey(today);
  const currentYear = today.getUTCFullYear();

  // Coast needs the birth year (the retirement horizon); null until one is set.
  let coast: number | null = null;
  let monthsToRetirement = 0;
  if (resolved.birthYear != null) {
    const yearsToRetirement = Math.max(
      0,
      resolved.birthYear + resolved.traditionalRetirementAge - currentYear,
    );
    monthsToRetirement = yearsToRetirement * 12;
    const c = coastNumber(fire, r, yearsToRetirement);
    coast = Number.isFinite(c) && c > 0 ? c : null;
  }

  // Solve both crossings in one walk (an unreachable/undrawable target yields
  // null). Infinity for an absent target keeps it out of the solve.
  const [monthsToCoast, monthsToFire] = monthsToReachEach(
    nestEgg,
    resolved.monthlyContribution,
    r,
    [coast ?? Infinity, fireDrawable ?? Infinity],
  );

  // Horizon: reach the furthest milestone (crossings + retirement age) with a
  // margin, clamped to the band. With nothing to aim at, show half the ceiling.
  const milestones = [monthsToFire, monthsToCoast, monthsToRetirement].filter(
    (m): m is number => m != null,
  );
  const furthest = milestones.length > 0 ? Math.max(...milestones) : HORIZON_MAX_MONTHS / 2;
  const horizon = clamp(Math.ceil(furthest * 1.15), HORIZON_MIN_MONTHS, HORIZON_MAX_MONTHS);

  const series = projectSeries(nestEgg, resolved.monthlyContribution, r, horizon);
  const projectionPoints: ProjectionChartPoint[] = series.map((value, i) => ({
    ym: shiftMonth(nowYm, i),
    value,
    projected: true,
  }));

  const historyPoints: ProjectionChartPoint[] = history
    .filter((p) => p.ym < nowYm)
    .map((p) => ({ ym: p.ym, value: p.net, projected: false }));

  // A crossing is drawn only if it lands within the horizon, so the marker
  // always maps to a real projected point.
  const withinHorizon = (months: number | null): string | null =>
    months != null && months <= horizon ? shiftMonth(nowYm, months) : null;

  return {
    points: [...historyPoints, ...projectionPoints],
    firstProjectedIndex: historyPoints.length,
    fireNumber: fireDrawable,
    coastNumber: coast,
    fireCrossingYm: withinHorizon(monthsToFire),
    coastCrossingYm: withinHorizon(monthsToCoast),
    birthYear: resolved.birthYear,
  };
}
