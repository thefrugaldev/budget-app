/**
 * Pure geometry helpers shared by the SVG charts (extracted in #104 so
 * GrowthColumns and MonthBarChart stop reimplementing the same math). No React,
 * no DOM — just value→pixel mapping, so they're SSR-safe and unit-testable, and
 * ready for the line/area charts the Net Worth / FIRE surfaces will want.
 *
 * Compose these; there is deliberately no configurable chart component. A bar
 * chart, a target meter, and a future trend line all share these two scales but
 * draw entirely different marks.
 */

/**
 * The ceiling a chart's value axis scales to: the largest of `values`, never
 * below `floor` (so an all-zero or empty dataset still divides cleanly),
 * optionally lifted by `headroom` — e.g. `0.15` leaves 15% of space above the
 * tallest mark so a reference line drawn at the max isn't flush to the top.
 */
export function domainMax(
  values: number[],
  { headroom = 0, floor = 1 }: { headroom?: number; floor?: number } = {},
): number {
  return Math.max(...values, floor) * (1 + headroom);
}

/**
 * Maps a data value to a pixel length along a value axis of `extentPx`, scaled
 * so `max` fills the extent. Negative values clamp to 0 — bars don't invert;
 * callers fold the app's signed amounts down to zero before drawing. `max` is
 * floored at a tiny positive internally, so a degenerate 0 domain can't divide
 * by zero (a $0.30-only month with no plan still yields a finite length).
 *
 * `length(v)` is a bar's height; a y-coordinate is `baseline - length(v)`,
 * which also positions horizontal reference lines at `baseline - length(target)`.
 */
export function linearScale(max: number, extentPx: number) {
  const safeMax = max > 0 ? max : 1;
  return {
    length: (value: number) => (Math.max(0, value) / safeMax) * extentPx,
  };
}

/**
 * Evenly divides a horizontal `extentPx` (beginning at `startPx`) into `count`
 * equal slots and centers content in each. `center(i)` is the mid-x of slot i;
 * a bar of width `w` sits at `center(i) - w / 2`. Bar width stays the caller's
 * choice, since each chart sizes bars differently. `count` is floored at 1 so
 * an empty dataset can't divide by zero.
 */
export function bandScale(count: number, extentPx: number, startPx = 0) {
  const slot = extentPx / Math.max(1, count);
  return {
    slot,
    center: (i: number) => startPx + slot * i + slot / 2,
  };
}
