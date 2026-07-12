/**
 * The value-axis gridlines + labels shared by the line/area charts — extracted
 * from `LineChart` once the FIRE `ProjectionChart` became the second consumer,
 * so both draw the same instrument rather than each reimplementing it. A
 * horizontal rule at every nice-scale tick with its value in the left gutter,
 * so a reader can map a mark's height onto real numbers.
 *
 * Pure SVG `<g>`s meant to render *inside* a parent `<svg>`: the caller owns the
 * plot geometry and passes the tick→pixel map (`yAt`) plus the gutter x. When the
 * domain straddles zero (a net-worth line that dips negative) `zeroTick` dashes
 * the zero rule to set it apart; charts anchored at zero leave it off.
 */
export function ValueGridlines({
  ticks,
  left,
  right,
  labelX,
  yAt,
  format,
  zeroTick = false,
}: {
  ticks: number[];
  /** Gridline start x (plot left edge). */
  left: number;
  /** Gridline end x (plot right edge). */
  right: number;
  /** Right-anchored x for the value label in the gutter. */
  labelX: number;
  yAt: (value: number) => number;
  format: (value: number) => string;
  /** Dash the `0` rule to distinguish it when the domain crosses zero. */
  zeroTick?: boolean;
}) {
  return (
    <>
      {ticks.map((t) => {
        const y = yAt(t);
        const isZero = zeroTick && t === 0;
        return (
          <g key={t}>
            <line
              x1={left}
              x2={right}
              y1={y}
              y2={y}
              className={isZero ? "stroke-muted-foreground/40" : "stroke-border"}
              strokeDasharray={isZero ? "3 3" : undefined}
            />
            <text
              x={labelX}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {format(t)}
            </text>
          </g>
        );
      })}
    </>
  );
}
