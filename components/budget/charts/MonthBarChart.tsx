"use client";

import { useState } from "react";

import type { CategoryKind, MonthBarDatum } from "@/types/budget";
import { barTone, fmt, monthLabel, monthLabelShort } from "@/lib/budget";
import { bandScale, domainMax, linearScale } from "@/lib/charts/scale";
import type { ThresholdTone } from "@/types/threshold";

// The bar fill reuses the same threshold model as the card meter and Pulse so
// the trend can never disagree with them: green under/near cap, amber at cap
// (90–100%), red over. A month with no cap that period has nothing to signal
// against, so it stays neutral.
const TONE_FILL: Record<ThresholdTone, string> = {
  good: "fill-signal-good",
  warn: "fill-signal-warn",
  bad: "fill-signal-bad",
};

/**
 * A labelled horizontal value line drawn across the whole plot — a reusable
 * overlay primitive (any value, not cap-specific), so a future chart can mark a
 * budget, an average, a goal, etc. Target-suggestions use it to draw the
 * current cap (dashed, muted) and the proposed cap (`emphasis`, solid) so the
 * two read apart. The `label`, right-aligned on the line, is the load-bearing
 * text readout — never colour or position alone.
 */
export type ReferenceLine = {
  value: number;
  label: string;
  emphasis?: boolean;
  dashed?: boolean;
};

export function MonthBarChart({
  data,
  kind,
  highlightYm,
  referenceLines,
  width = 360,
  height = 130,
}: {
  data: MonthBarDatum[];
  kind: CategoryKind;
  /** Optional month key (YYYY-MM) to emphasize. */
  highlightYm?: string;
  /** Labelled horizontal lines drawn over the bars (e.g. current + proposed cap). */
  referenceLines?: ReferenceLine[];
  width?: number;
  height?: number;
}) {
  // Symmetric horizontal padding: the cap readout rides its own reference line
  // (labelled at the right) rather than a left y-axis gutter, so the plot isn't
  // shoved off-centre and the bars fill the width evenly.
  const pad = { l: 10, r: 10, t: 14, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const baseline = pad.t + innerH;
  // Reference-line values join the domain so a proposed cap above every bar and
  // the current cap still fit inside the plot rather than clipping at the top.
  const domain = domainMax([
    ...data.map((d) => d.target),
    ...data.map((d) => d.total),
    ...(referenceLines?.map((r) => r.value) ?? []),
  ]);
  const yScale = linearScale(domain, innerH);
  const xBand = bandScale(data.length, innerW, pad.l);
  const barW = Math.max(4, xBand.slot - 8);

  // Hovered month index → cursor-following tooltip. Positioned in viewBox-%
  // (not px) so it tracks the bar regardless of the SVG's rendered size.
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered !== null ? data[hovered] : null;
  // Edge-aware horizontal anchor so a tooltip on the first/last bar stays inside
  // the (overflow-clipped) card instead of being cut off: right-align near the
  // right edge, left-align near the left, centre otherwise.
  const hoverFrac = hovered !== null ? xBand.center(hovered) / width : 0.5;
  const tooltipTx = hoverFrac > 0.72 ? "-100%" : hoverFrac < 0.28 ? "0%" : "-50%";

  return (
    <div className="relative">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="text-muted-foreground"
        onPointerLeave={() => setHovered(null)}
      >
        {data.map((d, i) => {
          const x = xBand.center(i) - barW / 2;
          const h = yScale.length(d.total);
          const y = baseline - h;
          const isCurrent = d.ym === highlightYm;
          const tone = barTone(kind, d.target, d.total);
          const color = tone ? TONE_FILL[tone] : "fill-muted-foreground";
          // Every month renders at full strength: a trend reads by its shape
          // across equally-weighted bars, and signal fills (over cap / net-
          // negative) must not be dimmed. The current month is called out by its
          // bold label, not by fading the rest — dimming would spotlight the one
          // in-progress (partial, often-empty) bar over the complete history.
          const label = `${monthLabel(d.ym)} · ${fmt(d.total)}`;
          return (
            <g key={d.ym}>
              <rect x={x} y={y} width={barW} height={h} rx={3} className={color} />
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                className={`fill-current text-[9px] ${isCurrent ? "font-semibold" : ""}`}
              >
                {monthLabelShort(d.ym)}
              </text>
              {/* Full-column hit target: hovering (or focusing) anywhere in the
                  month's slot surfaces the tooltip; the native <title> carries
                  the same text to keyboard/screen-reader users. */}
              <rect
                x={xBand.center(i) - xBand.slot / 2}
                y={pad.t}
                width={xBand.slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                className="cursor-default outline-none focus-visible:fill-muted-foreground/10"
                onPointerEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
              >
                <title>{label}</title>
              </rect>
            </g>
          );
        })}

        {/* Reference-line overlay: full-width labelled value lines over the
            bars — the current cap (dashed, muted) and, when a suggestion is
            live, the proposed cap (solid, emphasised). Each spells out its value
            for anyone who can't rely on the line's position alone. */}
        {referenceLines?.map((r) => {
          const y = baseline - yScale.length(r.value);
          return (
            <g key={r.label}>
              <line
                x1={pad.l}
                x2={width - pad.r}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={r.emphasis ? 0.9 : 0.5}
                strokeDasharray={r.dashed ? "3 3" : undefined}
                className={r.emphasis ? "text-foreground" : ""}
              />
              <text
                x={width - pad.r}
                y={y - 3}
                textAnchor="end"
                className={`fill-current text-[9px] ${r.emphasis ? "font-semibold text-foreground" : ""}`}
              >
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>

      {active && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-border"
          style={{
            left: `${(xBand.center(hovered!) / width) * 100}%`,
            top: `${((baseline - yScale.length(active.total)) / height) * 100}%`,
            transform: `translate(${tooltipTx}, calc(-100% - 4px))`,
          }}
        >
          <span className="font-medium">{monthLabel(active.ym)}</span>
          <span className="tabular-nums">
            {" · "}
            {fmt(active.total)}
          </span>
        </div>
      )}
    </div>
  );
}
