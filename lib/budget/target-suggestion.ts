/**
 * Target-suggestion domain helpers (#186, ADR 0006). The detector
 * (`selectTargetSuggestions`) lands here in a later chunk; this file starts with
 * the one pure piece it needs — turning a typical monthly figure into the
 * friendly, obviously-derived number a suggestion proposes.
 */

/**
 * The friendly rounding increment for a monthly figure of this magnitude. The
 * step widens with scale so the proposal is a clean round number whether it's a
 * $60 streaming bill or a $3,000 mortgage:
 *
 *   under $100 → $5 · under $250 → $10 · under $1,000 → $25 · $1,000+ → $50
 *
 * The band is chosen by the input figure (the median), not the rounded result.
 */
function incrementFor(value: number): number {
  if (value < 100) return 5;
  if (value < 250) return 10;
  if (value < 1000) return 25;
  return 50;
}

/**
 * Turn the evidence window's median monthly total into the proposed Target
 * shown in a suggestion (story 4): round **up** to the friendly increment for
 * its magnitude. Rounding up (rather than to-nearest) bakes a little headroom
 * into the proposal in both directions — a raised cap clears the typical month,
 * a lowered cap still leaves a touch of slack. The same rounding serves raise
 * and lower suggestions; direction is decided by the detector, not here.
 *
 * A figure already sitting on its increment is returned unchanged (a small
 * epsilon absorbs float error so `250` stays `250` rather than jumping to
 * `275`). A non-positive median has no sensible friendly cap, so it yields `0`;
 * the detector only calls this with a positive median.
 */
export function proposeTargetFromMedian(median: number): number {
  if (median <= 0) return 0;
  const step = incrementFor(median);
  return Math.ceil(median / step - 1e-9) * step;
}
