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

/**
 * Evenly places `count` points **edge-to-edge** across `extentPx` (beginning at
 * `startPx`): `at(0) === startPx`, `at(count - 1) === startPx + extentPx`. This
 * is the x-placement for a line/area chart — vertices span the full width —
 * whereas {@link bandScale} centers marks in slots (bars). A single point sits
 * at the start (no span to divide); `count` of 0 is treated the same.
 */
export function spreadX(count: number, extentPx: number, startPx = 0) {
  const span = count > 1 ? extentPx / (count - 1) : 0;
  return { at: (i: number) => startPx + span * i };
}

/**
 * Maps a value in a **signed** `[min, max]` domain to a y pixel measured from
 * the top of an `extentPx`-tall axis: `max → 0`, `min → extentPx`. Unlike
 * {@link linearScale} (a 0..max length for bars that never invert), this
 * supports negative values — a net-worth line dips below zero — and gives the
 * zero baseline as `y(0)` for an area fill or a zero reference line. A
 * degenerate `min === max` domain maps everything to the vertical middle, so a
 * flat series draws a centered line instead of dividing by zero.
 */
export function extentScale(min: number, max: number, extentPx: number) {
  const span = max - min;
  // One `y` closure with the degenerate guard inside: a `min === max` domain
  // maps everything to the vertical middle instead of dividing by zero, while a
  // real domain scales normally. Keeping it a single arrow (rather than two
  // return shapes) avoids an unused parameter on the degenerate branch.
  return {
    y: (value: number) => (span <= 0 ? extentPx / 2 : ((max - value) / span) * extentPx),
  };
}

// Round `value` to a "nice" number (1/2/5 × 10ⁿ) — the human-friendly step sizes
// axis gridlines land on. `round` snaps to the nearest nice number; otherwise it
// rounds up so a computed range fully contains the data.
function niceNumber(value: number, round: boolean): number {
  if (value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  } else {
    niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  }
  return niceFraction * 10 ** exponent;
}

/**
 * A "nice" value axis for a signed `[min, max]` domain: expands the bounds out to
 * round numbers and returns the gridline `ticks` between them. This is what lets
 * a trend chart draw labelled horizontal gridlines a reader can map the line's
 * height onto — and, in fit-to-data mode, gives a padded domain that fills the
 * plot with the data's own range instead of flattening it against zero.
 *
 * `tickCount` is a target, not a guarantee (the nice-rounding decides the real
 * step). A degenerate `min === max` domain is widened to a band around the value
 * so a flat series still yields sane, non-duplicate ticks rather than dividing by
 * zero. Pure — no rendering — so it unit-tests like the other scale helpers.
 */
export function niceScale(
  min: number,
  max: number,
  tickCount = 4,
): { niceMin: number; niceMax: number; ticks: number[]; step: number } {
  if (min === max) {
    // Widen a flat domain to ±10% (or ±1 at zero) so there's a range to divide.
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const targetSteps = Math.max(1, tickCount - 1);
  const range = niceNumber(max - min, false);
  const step = niceNumber(range / targetSteps, true) || 1;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  // Half-step slack absorbs float drift so the top tick isn't dropped.
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return { niceMin, niceMax, ticks, step };
}
