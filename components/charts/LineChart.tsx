import { areaPath, linePath } from "@/lib/charts/path";
import { extentScale, spreadX } from "@/lib/charts/scale";

/**
 * Shared presentational line/area chart (#109 chunk 4), the app-level charting
 * primitive the Net Worth trajectory (chunk 9) and the FIRE projection (#110)
 * both compose from — not a one-off per surface. Pure SVG, no state: it maps a
 * value series to a polyline (optionally filled to the zero baseline) via the
 * shared `lib/charts` geometry, in the Harvest idiom (token colors only,
 * `tabular-nums`, responsive `viewBox`).
 *
 * Signed-domain aware: the value axis spans `[min(values, 0), max(values, 0)]`,
 * so a series that dips negative (an underwater net worth) draws below a dashed
 * zero line rather than clamping flat. Empty input renders nothing.
 *
 * Accessibility: `ariaLabel` is **required** so the `role="img"` SVG is never an
 * unlabeled graphic — the guarantee lives in the primitive, not in each caller
 * remembering. Chunk 9 adds the richer per-point text alternative for the
 * net-worth series on top of this.
 */
const defaultFormat = (value: number): string =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function LineChart({
  points,
  area = false,
  width = 360,
  height = 140,
  className = "text-primary",
  formatValue = defaultFormat,
  ariaLabel,
}: {
  points: { label: string; value: number }[];
  /** Names the chart for screen readers (`role="img"`). Required — never unlabeled. */
  ariaLabel: string;
  /** Fill the region between the line and the zero baseline. */
  area?: boolean;
  width?: number;
  height?: number;
  /** Sets the line/area color via `currentColor`; a token text-* class. */
  className?: string;
  formatValue?: (value: number) => string;
}) {
  if (points.length === 0) return null;

  const pad = { l: 44, r: 10, t: 12, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;

  const values = points.map((p) => p.value);
  // Fold 0 into the domain so the zero baseline is always meaningful (and a
  // fully-positive series fills to the chart floor). `reduce` rather than
  // `Math.max(...values)` so a very long series can't blow the arg-count ceiling.
  const max = values.reduce((m, v) => Math.max(m, v), 0);
  const min = values.reduce((m, v) => Math.min(m, v), 0);
  const yScale = extentScale(min, max, innerH);
  const xAt = spreadX(points.length, innerW, pad.l);

  const coords = points.map((p, i) => ({ x: xAt.at(i), y: pad.t + yScale.y(p.value) }));
  const zeroY = pad.t + yScale.y(0);
  const last = coords[coords.length - 1];
  const showZeroLine = min < 0; // only when zero is above the floor

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Value-axis endpoints, muted regardless of the line color. */}
      <text x={pad.l - 6} y={pad.t + 3} textAnchor="end" className="fill-muted-foreground text-[9px] tabular-nums">
        {formatValue(max)}
      </text>
      {/* Skip the min label on a flat series — it would duplicate the max label. */}
      {min !== max && (
        <text x={pad.l - 6} y={pad.t + innerH + 3} textAnchor="end" className="fill-muted-foreground text-[9px] tabular-nums">
          {formatValue(min)}
        </text>
      )}

      {showZeroLine && (
        <line
          x1={pad.l}
          x2={pad.l + innerW}
          y1={zeroY}
          y2={zeroY}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeDasharray="3 3"
        />
      )}

      {area && (
        <path d={areaPath(coords, zeroY)} fill="currentColor" fillOpacity={0.12} stroke="none" />
      )}
      <path d={linePath(coords)} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={last.x} cy={last.y} r={3} className="fill-current" />

      {/* Sparse x labels: first and last only, so a long series doesn't crowd. */}
      <text x={coords[0].x} y={height - 6} textAnchor="start" className="fill-muted-foreground text-[9px]">
        {points[0].label}
      </text>
      {points.length > 1 && (
        <text x={last.x} y={height - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {points[points.length - 1].label}
        </text>
      )}
    </svg>
  );
}
