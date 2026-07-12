import { ValueGridlines } from "@/components/charts/ValueGridlines";
import { fmt, fmtCompact, monthLabel } from "@/lib/budget";
import { areaPath, linePath } from "@/lib/charts/path";
import { extentScale, niceScale, spreadX } from "@/lib/charts/scale";
import type { ProjectionChartData } from "@/types/fire";

/**
 * The FIRE projection chart (#110 chunk 5, stories 17, 18): recorded nest-egg
 * history flowing into the projected curve as one trajectory, with the FIRE and
 * coast numbers as horizontal reference lines whose crossings mark the projected
 * dates, over an age+year axis. It's a domain-specific composition of the shared
 * chart geometry (`lib/charts/scale`, `lib/charts/path`) — the same primitives
 * the Net Worth `LineChart` draws from — rather than a config knob on that chart,
 * so neither surface pays for the other's assumptions (ADR 0002 charting).
 *
 * Recorded vs projected is distinguished by **stroke, not color** (solid → dashed
 * at the junction) with a text legend, so it reads for colorblind users; the two
 * reference lines carry text labels ("FIRE" / "Coast") for the same reason. The
 * pure `buildProjectionChart` seam does the stitching and crossing solve, so this
 * stays presentational.
 *
 * A11y: a labelled `role="img"` summarizing the trajectory, plus a visually
 * hidden milestone table carrying the exact figures to screen readers (the same
 * pattern as the Net Worth trajectory). No motion, nothing for reduced-motion to
 * disable.
 */

const W = 680;
const H = 220;
const PAD = { l: 52, r: 66, t: 16, b: 42 };

export function ProjectionChart({ data }: { data: ProjectionChartData }) {
  const { points, firstProjectedIndex, fireNumber, coastNumber, fireCrossingYm, coastCrossingYm, birthYear } =
    data;

  if (points.length === 0) return null;

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  // The value axis must contain the reference lines, not just the curve, so the
  // FIRE/coast targets are visible even before the projection reaches them.
  const refs = [fireNumber, coastNumber].filter((v): v is number => v != null);
  const hi = Math.max(...points.map((p) => p.value), ...refs, 1);
  const { niceMin, niceMax, ticks } = niceScale(0, hi, 5);

  const yScale = extentScale(niceMin, niceMax, innerH);
  const xAt = spreadX(points.length, innerW, PAD.l);
  const yAt = (v: number) => PAD.t + yScale.y(v);

  const coords = points.map((p, i) => ({ x: xAt.at(i), y: yAt(p.value) }));

  // Recorded is a solid line; projected is dashed, starting at the last recorded
  // point so the two meet as one continuous trajectory.
  const solidCoords = coords.slice(0, firstProjectedIndex);
  const dashedCoords = coords.slice(Math.max(0, firstProjectedIndex - 1));
  const baselineY = yAt(niceMin);

  const ageAt = (ym: string): number | null =>
    birthYear != null ? Number(ym.slice(0, 4)) - birthYear : null;

  const crossingAt = (ym: string | null) => {
    if (ym == null) return null;
    const i = points.findIndex((p) => p.ym === ym);
    return i < 0 ? null : { x: coords[i].x, y: coords[i].y, ym };
  };
  const fireCrossing = crossingAt(fireCrossingYm);
  const coastCrossing = crossingAt(coastCrossingYm);

  // Sparse x ticks (year, and age below when a birth year is set), deduped by
  // year so a short horizon doesn't print the same year twice.
  const TICK_COUNT = 6;
  const tickYears = new Set<string>();
  const xTicks = Array.from({ length: TICK_COUNT }, (_, k) =>
    Math.round(((points.length - 1) * k) / (TICK_COUNT - 1)),
  )
    .filter((idx, i, arr) => arr.indexOf(idx) === i)
    .map((idx) => ({ idx, year: points[idx].ym.slice(0, 4) }))
    .filter(({ year }) => (tickYears.has(year) ? false : (tickYears.add(year), true)));

  // A reference line is drawable only when its value sits inside the axis range.
  const refY = (value: number | null): number | null =>
    value != null && value >= niceMin && value <= niceMax ? yAt(value) : null;
  const fireY = refY(fireNumber);
  const coastY = refY(coastNumber);

  const nowValue = points[firstProjectedIndex]?.value ?? points[0].value;
  const recorded = points.slice(0, firstProjectedIndex);
  const horizonYears = Math.round(
    (points.length - firstProjectedIndex) / 12,
  );

  // Screen-reader summary: the same story the chart tells, as one sentence.
  const crossingPhrase = (label: string, value: number | null, ym: string | null): string => {
    if (value == null) return "";
    if (ym == null)
      return ` The ${label} of ${fmt(value)} isn't reached within the ${horizonYears}-year horizon.`;
    const age = ageAt(ym);
    return ` It reaches the ${label} of ${fmt(value)} in ${monthLabel(ym)}${age != null ? ` at age ${age}` : ""}.`;
  };
  const summary =
    "Nest-egg projection. " +
    (recorded.length > 0
      ? `Recorded from ${fmt(recorded[0].value)} in ${monthLabel(recorded[0].ym)} to ${fmt(
          recorded[recorded.length - 1].value,
        )} in ${monthLabel(recorded[recorded.length - 1].ym)}, then projected from ${fmt(nowValue)} today.`
      : `Projected from ${fmt(nowValue)} today.`) +
    crossingPhrase("FIRE number", fireNumber, fireCrossingYm) +
    crossingPhrase("coast number", coastNumber, coastCrossingYm);

  return (
    <div className="touch-manipulation">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {/* Value gridlines + labels: the curve's height maps to real dollars. */}
        <ValueGridlines
          ticks={ticks}
          left={PAD.l}
          right={PAD.l + innerW}
          labelX={PAD.l - 8}
          yAt={yAt}
          format={fmtCompact}
        />

        {/* Projected area fill under the dashed curve (subtle), then the two
            stroke segments — solid recorded, dashed projected. */}
        {dashedCoords.length > 1 && (
          <path
            d={areaPath(dashedCoords, baselineY)}
            className="fill-primary"
            fillOpacity={0.08}
            stroke="none"
          />
        )}
        {solidCoords.length > 1 && (
          <path d={linePath(solidCoords)} fill="none" className="stroke-primary" strokeWidth={2} />
        )}
        {dashedCoords.length > 1 && (
          <path
            d={linePath(dashedCoords)}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        )}

        {/* Reference lines. Dashed with distinct patterns + text labels, so the
            two never rely on color to be told apart. */}
        {coastY != null && (
          <g>
            <line
              x1={PAD.l}
              x2={PAD.l + innerW}
              y1={coastY}
              y2={coastY}
              className="stroke-muted-foreground"
              strokeDasharray="2 4"
            />
            <text x={PAD.l + innerW + 4} y={coastY + 3} className="fill-muted-foreground text-[9px] font-medium">
              Coast
            </text>
            <text
              x={PAD.l + innerW + 4}
              y={coastY + 13}
              className="fill-muted-foreground text-[9px] tabular-nums"
            >
              {fmtCompact(coastNumber!)}
            </text>
          </g>
        )}
        {fireY != null && (
          <g>
            <line
              x1={PAD.l}
              x2={PAD.l + innerW}
              y1={fireY}
              y2={fireY}
              className="stroke-foreground"
              strokeDasharray="4 3"
            />
            <text x={PAD.l + innerW + 4} y={fireY - 3} className="fill-foreground text-[9px] font-semibold">
              FIRE
            </text>
            <text x={PAD.l + innerW + 4} y={fireY + 7} className="fill-foreground text-[9px] tabular-nums">
              {fmtCompact(fireNumber!)}
            </text>
          </g>
        )}

        {/* Crossing markers: where the projection meets a reference line. */}
        {[
          { c: coastCrossing, label: "coast" },
          { c: fireCrossing, label: "fire" },
        ].map(({ c, label }) =>
          c == null ? null : (
            <g key={label}>
              <circle cx={c.x} cy={c.y} r={3.5} className="fill-foreground" />
              <text
                x={c.x}
                y={c.y - 8}
                textAnchor="middle"
                className="fill-foreground text-[9px] tabular-nums"
              >
                {c.ym.slice(0, 4)}
                {ageAt(c.ym) != null ? ` · ${ageAt(c.ym)}` : ""}
              </text>
            </g>
          ),
        )}

        {/* X axis: year, with age below when a birth year is set (story 18). */}
        {xTicks.map(({ idx, year }) => {
          const x = coords[idx].x;
          const anchor = idx === 0 ? "start" : idx === points.length - 1 ? "end" : "middle";
          const age = ageAt(points[idx].ym);
          return (
            <g key={idx}>
              <text x={x} y={H - 16} textAnchor={anchor} className="fill-muted-foreground text-[10px] tabular-nums">
                {year}
              </text>
              {age != null && (
                <text x={x} y={H - 4} textAnchor={anchor} className="fill-muted-foreground/70 text-[9px] tabular-nums">
                  age {age}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Text legend: names the solid/dashed distinction so it isn't color-only. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden className="text-primary">
            <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" />
          </svg>
          Recorded
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden className="text-primary">
            <line x1="0" y1="3" x2="18" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" />
          </svg>
          Projected
        </span>
      </div>

      {/* The chart's milestones as text for screen readers. */}
      <table className="sr-only">
        <caption>FIRE projection milestones</caption>
        <thead>
          <tr>
            <th scope="col">Milestone</th>
            <th scope="col">Amount</th>
            <th scope="col">Projected date</th>
            <th scope="col">Age</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Nest egg today</th>
            <td>{fmt(nowValue)}</td>
            <td>—</td>
            <td>—</td>
          </tr>
          {fireNumber != null && (
            <tr>
              <th scope="row">FIRE number</th>
              <td>{fmt(fireNumber)}</td>
              <td>{fireCrossingYm ? monthLabel(fireCrossingYm) : "Not within horizon"}</td>
              <td>{fireCrossingYm && ageAt(fireCrossingYm) != null ? ageAt(fireCrossingYm) : "—"}</td>
            </tr>
          )}
          {coastNumber != null && (
            <tr>
              <th scope="row">Coast number</th>
              <td>{fmt(coastNumber)}</td>
              <td>{coastCrossingYm ? monthLabel(coastCrossingYm) : "Not within horizon"}</td>
              <td>{coastCrossingYm && ageAt(coastCrossingYm) != null ? ageAt(coastCrossingYm) : "—"}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
