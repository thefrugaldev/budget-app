"use client";

import { useState } from "react";

import { areaPath, linePath } from "@/lib/charts/path";
import { extentScale, niceScale, spreadX } from "@/lib/charts/scale";
import { cn } from "@/lib/utils";

/**
 * Shared presentational line/area chart (#109 chunk 4, deepened in chunk 9), the
 * app-level charting primitive the Net Worth trajectory and the FIRE projection
 * (#110) both compose from — not a one-off per surface. It draws a value series
 * as a polyline (optionally filled to the baseline) over labelled gridlines, in
 * the Harvest idiom (token colors only, `tabular-nums`).
 *
 * It reads as an *instrument*, not a sparkline: horizontal gridlines with value
 * labels (nice-rounded via `niceScale`) let a reader map the line's height onto
 * concrete numbers, and — when `formatPoint` is supplied — every vertex becomes a
 * hoverable, keyboard-focusable point that reveals that period's figures. The
 * caller decides what a point *says* (the domain semantics), so the primitive
 * stays domain-agnostic.
 *
 * Baseline modes: `"zero"` folds zero into the domain (honest magnitude — the
 * fill sits on the zero line); `"fit"` hugs the data's own range so a large-but-
 * slowly-moving series (net worth) shows its trend instead of flattening against
 * zero.
 *
 * A11y: the SVG is a labelled `role="img"` (never unlabelled — `ariaLabel` is
 * required); each interactive point is a focusable control carrying its own
 * `aria-label`, so keyboard and screen-reader users get every value, mirroring
 * the Pulse chart. The visual tooltip is `aria-hidden` (its content already
 * reaches AT through the point labels and the caller's data table). Focus is
 * shown by the active guide + enlarged marker; the reveal carries no motion, so
 * there's nothing for reduced-motion to disable.
 */
// Compact axis labels ("$210k", "$1.2M") keep the value gutter narrow; the
// tooltip and the caller's table carry the exact figures.
const compactFormat = (value: number): string =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });

export type LinePoint = { label: string; value: number };
// `detailClassName` lets the caller tone the change line (e.g. a signal token) —
// the primitive stays domain-agnostic and doesn't decide what "good" means.
export type PointDetail = { title: string; detail?: string; detailClassName?: string };

const W = 680;
const H = 200;
const PAD = { l: 52, r: 14, t: 14, b: 26 };

export function LineChart({
  points,
  ariaLabel,
  area = false,
  baseline = "zero",
  className = "text-primary",
  formatAxis = compactFormat,
  formatPoint,
}: {
  points: LinePoint[];
  /** Names the chart for screen readers (`role="img"`). Required — never unlabeled. */
  ariaLabel: string;
  /** Fill the region between the line and the baseline. */
  area?: boolean;
  /** `"zero"` anchors the axis at zero; `"fit"` hugs the data's own range. */
  baseline?: "zero" | "fit";
  /** Sets the line/area color via `currentColor`; a token text-* class. */
  className?: string;
  /** Compact value format for the axis gutter. */
  formatAxis?: (value: number) => string;
  /** When set, each vertex becomes an interactive point revealing this content. */
  formatPoint?: (point: LinePoint, index: number, points: LinePoint[]) => PointDetail;
}) {
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) return null;

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const values = points.map((p) => p.value);
  const dataMin = values.reduce((m, v) => Math.min(m, v), values[0]);
  const dataMax = values.reduce((m, v) => Math.max(m, v), values[0]);
  // "zero" folds 0 into the domain; "fit" lets the axis start above zero.
  const lo = baseline === "zero" ? Math.min(0, dataMin) : dataMin;
  const hi = baseline === "zero" ? Math.max(0, dataMax) : dataMax;
  const { niceMin, niceMax, ticks } = niceScale(lo, hi, 4);

  const yScale = extentScale(niceMin, niceMax, innerH);
  const xAt = spreadX(points.length, innerW, PAD.l);
  const yAt = (v: number) => PAD.t + yScale.y(v);

  const coords = points.map((p, i) => ({ x: xAt.at(i), y: yAt(p.value) }));
  const last = coords[coords.length - 1];
  const baselineY = yAt(niceMin); // the fill floor (bottom of the plot)
  const showZeroLine = niceMin < 0 && niceMax > 0;

  const interactive = typeof formatPoint === "function";
  // Half-gap on each side so a point's hit band covers the space up to its
  // neighbours; a lone point owns the whole width.
  const gap = points.length > 1 ? innerW / (points.length - 1) : innerW;

  // Sparse x labels: aim for ~7 max so a 12-month series doesn't crowd.
  const labelStep = Math.max(1, Math.ceil(points.length / 7));
  const showXLabel = (i: number) => i === 0 || i === points.length - 1 || i % labelStep === 0;

  return (
    <div className="relative touch-manipulation">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={ariaLabel}>
        {/* Gridlines + value labels: the line's height maps to real numbers. */}
        {ticks.map((t) => {
          const y = yAt(t);
          const isZero = t === 0 && showZeroLine;
          return (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={PAD.l + innerW}
                y1={y}
                y2={y}
                className={isZero ? "stroke-muted-foreground/40" : "stroke-border"}
                strokeDasharray={isZero ? "3 3" : undefined}
              />
              <text
                x={PAD.l - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {formatAxis(t)}
              </text>
            </g>
          );
        })}

        {area && <path d={areaPath(coords, baselineY)} fill="currentColor" fillOpacity={0.1} stroke="none" />}
        <path d={linePath(coords)} fill="none" stroke="currentColor" strokeWidth={2} />

        {/* Active guide + emphasized marker double as the hover/focus indicator. */}
        {active !== null && (
          <line
            x1={coords[active].x}
            x2={coords[active].x}
            y1={PAD.t}
            y2={PAD.t + innerH}
            className="stroke-muted-foreground/40"
          />
        )}
        <circle cx={last.x} cy={last.y} r={3.5} className="fill-current" />
        {active !== null && (
          <circle cx={coords[active].x} cy={coords[active].y} r={5} className="fill-current" />
        )}

        {/* X labels below the plot. */}
        {points.map((p, i) =>
          showXLabel(i) ? (
            <text
              key={p.label + i}
              x={coords[i].x}
              y={H - 7}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-[10px]"
            >
              {p.label}
            </text>
          ) : null,
        )}

        {/* Focusable/hoverable hit bands (only when interactive). Transparent
            rects spanning each point's column; focus/hover sets the active point.
            role="button" + aria-label mirrors the Pulse chart's approach. */}
        {interactive &&
          points.map((p, i) => {
            const bandX = Math.max(PAD.l, coords[i].x - gap / 2);
            const bandW = Math.min(PAD.l + innerW, coords[i].x + gap / 2) - bandX;
            const d = formatPoint(p, i, points);
            return (
              <rect
                key={"hit" + i}
                x={bandX}
                y={PAD.t}
                width={bandW}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={d.detail ? `${d.title}. ${d.detail}` : d.title}
                className="cursor-pointer outline-none focus-visible:stroke-2 focus-visible:stroke-ring"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((a) => (a === i ? null : a))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((a) => (a === i ? null : a))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setActive(null);
                }}
              />
            );
          })}
      </svg>

      {/* Visual tooltip for the active point. aria-hidden: its data already
          reaches AT via the point aria-labels and the caller's data table.
          Positioned in the wrapper's percentage space (the SVG fills the
          wrapper, so viewBox units map linearly); anchored inward at the edges
          so first/last tooltips don't clip. */}
      {interactive &&
        active !== null &&
        (() => {
          const d = formatPoint(points[active], active, points);
          const anchor = active === 0 ? "0" : active === points.length - 1 ? "-100%" : "-50%";
          return (
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute z-10 text-popover-foreground",
                "whitespace-nowrap rounded-lg bg-popover px-2.5 py-1.5 text-xs shadow-md ring-1 ring-border",
              )}
              style={{
                left: `${(coords[active].x / W) * 100}%`,
                top: `${(coords[active].y / H) * 100}%`,
                transform: `translate(${anchor}, calc(-100% - 10px))`,
              }}
            >
              <p className="font-medium tabular-nums">{d.title}</p>
              {d.detail && (
                <p className={cn("mt-0.5 tabular-nums", d.detailClassName ?? "text-muted-foreground")}>
                  {d.detail}
                </p>
              )}
            </div>
          );
        })()}
    </div>
  );
}
