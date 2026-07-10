/**
 * SVG path builders for line/area marks (#109 chunk 4), the path-string half of
 * the shared chart geometry — {@link ./scale} maps values to the pixel points,
 * these serialize those points into `d` attributes. Pure and SSR-safe; the
 * Net Worth trajectory and the FIRE projection both draw from them.
 */

type Point = { x: number; y: number };

// Two decimals keeps `d` attributes tidy without visibly moving a mark.
const round = (n: number): number => Math.round(n * 100) / 100;

/** A polyline through the points as an SVG path (`"M … L … L …"`); `""` when empty. */
export function linePath(points: readonly Point[]): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`)
    .join(" ");
}

/**
 * The filled area between the polyline and a horizontal `baselineY` (usually the
 * zero line or the axis bottom): the line, then down to the baseline and back,
 * closed. `""` when empty. The baseline is passed in — not assumed to be the
 * chart bottom — so the fill can sit against zero when a series goes negative.
 */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L ${round(last.x)} ${round(baselineY)} L ${round(first.x)} ${round(baselineY)} Z`;
}
